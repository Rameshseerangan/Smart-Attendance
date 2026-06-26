"""
Student management endpoints — Admin Module ("Manage Students").
Face enrollment is a separate endpoint since it's multipart/form-data (images),
keeping the JSON-only CRUD endpoints clean.
"""
from datetime import datetime
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.core.database import get_database
from app.core.deps import require_role
from app.schemas.student import (
    FaceEnrollmentResponse,
    StudentCreate,
    StudentResponse,
    StudentUpdate,
)
from app.services.cv_pipeline.face_enrollment_service import FaceEnrollmentService

router = APIRouter(prefix="/students", tags=["Student Management"])


@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
async def create_student(
    payload: StudentCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("admin")),
):
    now = datetime.utcnow()
    doc = payload.model_dump()
    doc.update(
        {"is_active": True, "face_enrolled": False, "enrolled_face_count": 0,
         "created_at": now, "updated_at": now}
    )
    try:
        result = await db.students.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="A student with this register number already exists")

    created = await db.students.find_one({"_id": result.inserted_id})
    return StudentResponse(**created)


@router.get("", response_model=List[StudentResponse])
async def list_students(
    department: Optional[str] = None,
    year: Optional[int] = None,
    section: Optional[str] = None,
    search: Optional[str] = Query(None, description="Search by name or register number"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("admin", "faculty")),
):
    query: dict = {}
    if department:
        query["department"] = department
    if year:
        query["year"] = year
    if section:
        query["section"] = section
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"register_no": {"$regex": search, "$options": "i"}},
        ]

    cursor = db.students.find(query).sort("register_no", 1)
    students = [StudentResponse(**doc) async for doc in cursor]
    return students


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("admin", "faculty")),
):
    doc = await db.students.find_one({"_id": ObjectId(student_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Student not found")
    return StudentResponse(**doc)


@router.patch("/{student_id}", response_model=StudentResponse)
async def update_student(
    student_id: str,
    payload: StudentUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("admin")),
):
    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")
    update_data["updated_at"] = datetime.utcnow()

    result = await db.students.update_one({"_id": ObjectId(student_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")

    doc = await db.students.find_one({"_id": ObjectId(student_id)})
    return StudentResponse(**doc)


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(
    student_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("admin")),
):
    # Soft-delete is generally preferred for attendance systems — historical
    # attendance records reference student_id and must remain valid for reports.
    result = await db.students.update_one(
        {"_id": ObjectId(student_id)}, {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")


@router.post("/{student_id}/enroll-face", response_model=FaceEnrollmentResponse)
async def enroll_student_face(
    student_id: str,
    images: List[UploadFile] = File(..., description="3-5 clear face photos recommended"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("admin", "faculty")),
):
    student = await db.students.find_one({"_id": ObjectId(student_id)})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    service = FaceEnrollmentService(db)
    enrolled, rejected, reasons = await service.enroll_student_faces(student_id, images)

    message = (
        f"{enrolled} face(s) enrolled successfully."
        if enrolled > 0
        else "No faces were enrolled — please check rejection reasons."
    )

    return FaceEnrollmentResponse(
        student_id=student_id,
        register_no=student["register_no"],
        images_received=len(images),
        faces_enrolled=enrolled,
        faces_rejected=rejected,
        rejection_reasons=reasons,
        message=message,
    )
