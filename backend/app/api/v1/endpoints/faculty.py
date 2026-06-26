from datetime import datetime
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.core.database import get_database
from app.core.deps import require_role
from app.core.security import hash_password
from app.schemas.faculty import FacultyCreate, FacultyResponse, FacultyUpdate

router = APIRouter(prefix="/faculty", tags=["Faculty Management"])


@router.post("", response_model=FacultyResponse, status_code=status.HTTP_201_CREATED)
async def create_faculty(
    payload: FacultyCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("admin")),
):
    now = datetime.utcnow()
    doc = payload.model_dump(exclude={"password"})
    doc.update(
        {"password_hash": hash_password(payload.password), "is_active": True, "created_at": now}
    )
    try:
        result = await db.faculty.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="A faculty member with this email already exists")

    created = await db.faculty.find_one({"_id": result.inserted_id})
    return FacultyResponse(**created)


@router.get("", response_model=List[FacultyResponse])
async def list_faculty(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("admin")),
):
    cursor = db.faculty.find().sort("name", 1)
    return [FacultyResponse(**doc) async for doc in cursor]


@router.patch("/{faculty_id}", response_model=FacultyResponse)
async def update_faculty(
    faculty_id: str,
    payload: FacultyUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("admin")),
):
    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    result = await db.faculty.update_one({"_id": ObjectId(faculty_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Faculty not found")

    doc = await db.faculty.find_one({"_id": ObjectId(faculty_id)})
    return FacultyResponse(**doc)


@router.delete("/{faculty_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_faculty(
    faculty_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("admin")),
):
    result = await db.faculty.update_one(
        {"_id": ObjectId(faculty_id)}, {"$set": {"is_active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Faculty not found")
