"""
Attendance Processing Orchestrator.

Implements the complete workflow from the spec:
  Capture -> Face Detection -> Face Recognition -> Liveness Verification
  -> Attendance Processing -> Database Storage

Runs as a background task (FastAPI BackgroundTasks) so the upload endpoint
returns immediately with a job_id; the frontend polls /attendance/jobs/{id}.

De-duplication rule enforced here: a student recognized in MULTIPLE sampled
frames within the same video is only marked present ONCE — we track seen
student_ids per session in memory during processing, and the DB unique index
on (student_id, subject_id, date) is the final backstop.
"""
import os
import re
import uuid
from datetime import datetime, date as date_type
from typing import Optional

from loguru import logger
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.schemas.attendance import JobStatus
from app.services.cv_pipeline.face_engine import get_face_engine
from app.services.cv_pipeline.face_matcher import FaceMatcher
from app.services.cv_pipeline.frame_extractor import extract_frames, count_sampled_frames
from app.services.cv_pipeline.liveness_detector import get_liveness_detector


class AttendanceProcessor:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.face_engine = get_face_engine()
        self.liveness_detector = get_liveness_detector()
        self.matcher = FaceMatcher(db)

    async def create_job(self, subject_id: str, date: str, faculty_id: str, filepath: str) -> str:
        job_id = str(uuid.uuid4())
        await self.db.attendance_jobs.insert_one(
            {
                "job_id": job_id,
                "subject_id": subject_id,
                "date": date,
                "faculty_id": faculty_id,
                "filepath": filepath,
                "status": JobStatus.QUEUED.value,
                "progress_percent": 0,
                "total_frames_processed": 0,
                "students_recognized": 0,
                "students_flagged_spoof": 0,
                "error_message": None,
                "result_summary": None,
                "created_at": datetime.utcnow(),
            }
        )
        return job_id

    async def _update_job(self, job_id: str, **fields):
        await self.db.attendance_jobs.update_one({"job_id": job_id}, {"$set": fields})

    async def process_session(self, job_id: str):
        """
        Entry point invoked by the background task. Wrapped in a broad try/except
        because this runs detached from the request — any unhandled exception
        here would otherwise vanish silently with no error surfaced to the user.
        """
        job = await self.db.attendance_jobs.find_one({"job_id": job_id})
        if not job:
            logger.error(f"Job {job_id} not found.")
            return

        try:
            await self._update_job(job_id, status=JobStatus.PROCESSING.value)

            subject = await self.db.subjects.find_one({"_id": self._oid(job["subject_id"])})
            if not subject:
                raise ValueError(f"Subject {job['subject_id']} not found")

            # Scope candidate pool to this subject's department/year/section —
            # reduces false matches and speeds up per-frame matching.
            num_loaded = await self.matcher.load_enrolled_embeddings(
                department=subject["department"], year=subject["year"], section=subject["section"]
            )
            logger.info(f"Loaded {num_loaded} enrolled face embeddings for matching.")

            if num_loaded == 0:
                raise ValueError(
                    "No enrolled students with face data found for this subject's "
                    "department/year/section. Enroll student faces first."
                )

            total_frames_estimate = count_sampled_frames(job["filepath"])
            seen_student_ids = set()
            frames_processed = 0
            spoof_flags = 0
            recognized_in_session = {}  # student_id -> best confidence seen

            for frame in extract_frames(job["filepath"]):
                detected_faces = self.face_engine.detect_and_encode(frame)

                for face in detected_faces:
                    match = self.matcher.find_best_match(face.embedding)
                    if not match.is_match:
                        continue  # unknown face — skip silently (could log for review)

                    if match.student_id in seen_student_ids:
                        continue  # already marked present this session — skip re-check

                    is_live, liveness_score = self.liveness_detector.is_live(face.cropped_face)
                    logger.info(
                        f"Liveness check: {match.name} ({match.register_no}) "
                        f"score={liveness_score:.3f} live={is_live} "
                        f"(check_enabled={settings.LIVENESS_CHECK_ENABLED})"
                    )

                    if not is_live and settings.LIVENESS_CHECK_ENABLED:
                        spoof_flags += 1
                        logger.warning(
                            f"Spoof attempt flagged: {match.name} ({match.register_no}) "
                            f"liveness_score={liveness_score:.3f}"
                        )
                        continue  # do NOT mark present — this is the anti-proxy enforcement point

                    seen_student_ids.add(match.student_id)
                    recognized_in_session[match.student_id] = {
                        "register_no": match.register_no,
                        "name": match.name,
                        "confidence": match.similarity,
                        "liveness_score": liveness_score,
                    }

                frames_processed += 1
                progress = min(99, int((frames_processed / max(1, total_frames_estimate)) * 100))
                await self._update_job(
                    job_id,
                    progress_percent=progress,
                    total_frames_processed=frames_processed,
                    students_recognized=len(seen_student_ids),
                    students_flagged_spoof=spoof_flags,
                )

            # ---- Attendance Processing & Database Storage ----
            summary = await self._commit_attendance(
                job=job, subject=subject, recognized=recognized_in_session
            )

            await self._update_job(
                job_id,
                status=JobStatus.COMPLETED.value,
                progress_percent=100,
                result_summary=summary,
            )
            logger.success(f"Job {job_id} completed: {summary}")

        except Exception as exc:
            logger.exception(f"Job {job_id} failed: {exc}")
            await self._update_job(
                job_id, status=JobStatus.FAILED.value, error_message=str(exc)
            )
        finally:
            # Clean up the uploaded file regardless of outcome — avoids disk bloat
            try:
                if os.path.exists(job["filepath"]):
                    os.remove(job["filepath"])
            except OSError:
                pass

    async def _commit_attendance(self, job: dict, subject: dict, recognized: dict) -> dict:
        """
        Marks Present for every recognized+live student, Absent for every other
        enrolled student in the subject's cohort. Uses upsert so re-running a
        session for the same date/subject updates rather than duplicates.
        """
        all_students_cursor = self.db.students.find(
            {
                "department": {"$regex": f"^{re.escape(subject['department'])}$", "$options": "i"},
                "year": subject["year"],
                "section": {"$regex": f"^{re.escape(subject['section'])}$", "$options": "i"},
                "is_active": True,
            }
        )
        all_students = [s async for s in all_students_cursor]

        now = datetime.utcnow()
        present_count, absent_count = 0, 0

        for student in all_students:
            sid = str(student["_id"])
            is_present = sid in recognized
            status = "Present" if is_present else "Absent"
            present_count += int(is_present)
            absent_count += int(not is_present)

            record = {
                "student_id": sid,
                "register_no": student["register_no"],
                "student_name": student["name"],
                "subject_id": job["subject_id"],
                "subject_code": subject["subject_code"],
                "date": job["date"],
                "time": now.strftime("%H:%M:%S"),
                "status": status,
                "confidence": recognized.get(sid, {}).get("confidence"),
                "liveness_score": recognized.get(sid, {}).get("liveness_score"),
                "marked_by": job["faculty_id"],
                "session_id": job["job_id"],
                "created_at": now,
            }

            await self.db.attendance.update_one(
                {"student_id": sid, "subject_id": job["subject_id"], "date": job["date"]},
                {"$set": record},
                upsert=True,
            )

        return {
            "total_students": len(all_students),
            "present": present_count,
            "absent": absent_count,
            "spoof_attempts_blocked": len(recognized) and job.get("students_flagged_spoof", 0),
        }

    @staticmethod
    def _oid(id_str: str):
        from bson import ObjectId
        return ObjectId(id_str)