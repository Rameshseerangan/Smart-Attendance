"""
Face Enrollment Service.

Handles the "register a student's face" workflow — the data that the attendance
pipeline later matches against. Best practice (and what gets you to 98-99%
accuracy in practice): enroll 3-5 photos per student at slightly different
angles/lighting, average or store multiple embeddings, not just one.
"""
from datetime import datetime
from typing import List, Tuple

import cv2
import numpy as np
from fastapi import UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.cv_pipeline.face_engine import get_face_engine


class FaceEnrollmentService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.face_engine = get_face_engine()

    async def enroll_student_faces(
        self, student_id: str, images: List[UploadFile]
    ) -> Tuple[int, int, List[str]]:
        """
        Returns (faces_enrolled, faces_rejected, rejection_reasons).
        Each accepted image contributes ONE embedding document — storing multiple
        embeddings per student (rather than averaging) lets the matcher check
        against all of them and take the best score, which is more robust to
        lighting/angle variance than a single averaged vector.
        """
        enrolled, rejected = 0, 0
        reasons: List[str] = []

        for image in images:
            contents = await image.read()
            np_array = np.frombuffer(contents, dtype=np.uint8)
            frame = cv2.imdecode(np_array, cv2.IMREAD_COLOR)

            if frame is None:
                rejected += 1
                reasons.append(f"{image.filename}: could not decode image")
                continue

            faces = self.face_engine.detect_and_encode(frame)

            if len(faces) == 0:
                rejected += 1
                reasons.append(f"{image.filename}: no face detected")
                continue

            if len(faces) > 1:
                rejected += 1
                reasons.append(
                    f"{image.filename}: multiple faces detected — enrollment photos "
                    "must contain exactly one person"
                )
                continue

            face = faces[0]
            await self.db.face_embeddings.insert_one(
                {
                    "student_id": student_id,
                    "embedding": face.embedding.tolist(),
                    "det_score": face.det_score,
                    "source_filename": image.filename,
                    "capture_date": datetime.utcnow(),
                }
            )
            enrolled += 1

        # Update denormalized enrollment flags on the student doc for fast list-view checks
        if enrolled > 0:
            from bson import ObjectId
            total = await self.db.face_embeddings.count_documents({"student_id": student_id})
            await self.db.students.update_one(
                {"_id": ObjectId(student_id)},
                {"$set": {"face_enrolled": True, "enrolled_face_count": total,
                          "updated_at": datetime.utcnow()}},
            )

        return enrolled, rejected, reasons
