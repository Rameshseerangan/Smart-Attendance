"""
Attendance Session Endpoints — the core feature.

Flow:
  1. POST /attendance/sessions/upload  -> faculty uploads classroom video/image
                                           returns job_id immediately (202 Accepted)
  2. GET  /attendance/jobs/{job_id}    -> frontend polls this for progress/result
  3. GET  /attendance/records          -> view committed attendance after completion

Why BackgroundTasks and not a blocking call: face detection + liveness + matching
on a multi-minute video takes real wall-clock time. Blocking the HTTP request
would hit gateway/browser timeouts. BackgroundTasks runs it after the response
is sent, in the same process — sufficient for local/single-server use. At
multi-faculty-concurrent scale, swap this for a Celery worker queue (see
requirements.txt note) without changing the AttendanceProcessor class itself.
"""
import os
import uuid
from datetime import date as date_type
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.database import get_database
from app.core.deps import require_role
from app.schemas.attendance import (
    AttendanceJobResponse,
    AttendanceJobStatusResponse,
    AttendanceRecord,
    JobStatus,
)
from app.services.cv_pipeline.attendance_processor import AttendanceProcessor
from app.services.cv_pipeline.frame_extractor import get_file_type

router = APIRouter(prefix="/attendance", tags=["Attendance Processing"])

ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".jpg", ".jpeg", ".png"}


@router.post(
    "/sessions/upload", response_model=AttendanceJobResponse, status_code=status.HTTP_202_ACCEPTED
)
async def upload_attendance_session(
    background_tasks: BackgroundTasks,
    subject_id: str,
    date: Optional[str] = None,
    file: UploadFile = File(..., description="Classroom video or image"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("faculty", "admin")),
):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}",
        )

    subject = await db.subjects.find_one({"_id": _oid(subject_id)})
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    session_date = date or date_type.today().isoformat()

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    saved_filename = f"{uuid.uuid4()}{ext}"
    saved_path = os.path.join(settings.UPLOAD_DIR, saved_filename)

    with open(saved_path, "wb") as f:
        # Stream to disk in chunks rather than reading entire file into memory —
        # matters for multi-minute classroom videos (could be 100s of MB).
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)

    processor = AttendanceProcessor(db)
    job_id = await processor.create_job(
        subject_id=subject_id, date=session_date, faculty_id=current_user["id"], filepath=saved_path
    )

    background_tasks.add_task(_run_processing, job_id, db)

    return AttendanceJobResponse(
        job_id=job_id,
        status=JobStatus.QUEUED,
        subject_id=subject_id,
        date=session_date,
        message="File uploaded successfully. Processing started in the background.",
    )


async def _run_processing(job_id: str, db: AsyncIOMotorDatabase):
    processor = AttendanceProcessor(db)
    await processor.process_session(job_id)


@router.get("/jobs/{job_id}", response_model=AttendanceJobStatusResponse)
async def get_job_status(
    job_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("faculty", "admin")),
):
    job = await db.attendance_jobs.find_one({"job_id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return AttendanceJobStatusResponse(
        job_id=job["job_id"],
        status=job["status"],
        progress_percent=job.get("progress_percent", 0),
        total_frames_processed=job.get("total_frames_processed", 0),
        students_recognized=job.get("students_recognized", 0),
        students_flagged_spoof=job.get("students_flagged_spoof", 0),
        error_message=job.get("error_message"),
        result_summary=job.get("result_summary"),
    )


@router.get("/records", response_model=List[AttendanceRecord])
async def get_attendance_records(
    subject_id: Optional[str] = None,
    date: Optional[str] = None,
    student_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("faculty", "admin")),
):
    query = {}
    if subject_id:
        query["subject_id"] = subject_id
    if date:
        query["date"] = date
    if student_id:
        query["student_id"] = student_id
    if status_filter:
        query["status"] = status_filter

    cursor = db.attendance.find(query).sort([("date", -1), ("time", -1)])
    return [AttendanceRecord(**doc) async for doc in cursor]


def _oid(id_str: str):
    from bson import ObjectId
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")
