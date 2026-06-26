from datetime import datetime
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.core.database import get_database
from app.core.deps import require_role
from app.schemas.faculty import SubjectCreate, SubjectResponse

router = APIRouter(prefix="/subjects", tags=["Subject & Course Management"])


@router.post("", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
async def create_subject(
    payload: SubjectCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("admin")),
):
    faculty = await db.faculty.find_one({"_id": ObjectId(payload.faculty_id)})
    if not faculty:
        raise HTTPException(status_code=404, detail="Assigned faculty not found")

    doc = payload.model_dump()
    doc["created_at"] = datetime.utcnow()

    try:
        result = await db.subjects.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="A subject with this code already exists")

    created = await db.subjects.find_one({"_id": result.inserted_id})
    return SubjectResponse(**created, faculty_name=faculty["name"])


@router.get("", response_model=List[SubjectResponse])
async def list_subjects(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("admin", "faculty")),
):
    query = {}
    # Faculty only sees subjects assigned to them; admin sees all
    if current_user["role"] == "faculty":
        query["faculty_id"] = current_user["id"]

    cursor = db.subjects.find(query).sort("subject_code", 1)
    subjects = []
    async for doc in cursor:
        faculty = await db.faculty.find_one({"_id": ObjectId(doc["faculty_id"])})
        subjects.append(SubjectResponse(**doc, faculty_name=faculty["name"] if faculty else None))
    return subjects


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(
    subject_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("admin")),
):
    result = await db.subjects.delete_one({"_id": ObjectId(subject_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subject not found")
