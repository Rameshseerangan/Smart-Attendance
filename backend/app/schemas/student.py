"""
Student schemas. Note FaceEmbedding is intentionally NOT embedded directly inside
StudentResponse for list views — embeddings are 512-float arrays (heavy payload).
They live in a separate `face_embeddings` collection and are fetched only when needed
(e.g. during the recognition pipeline), keeping student list/search endpoints fast.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import MongoBaseModel, PyObjectId


class StudentBase(BaseModel):
    register_no: str = Field(..., examples=["21CS045"])
    name: str = Field(..., min_length=2, max_length=100)
    department: str = Field(..., examples=["CSE"])
    year: int = Field(..., ge=1, le=5)
    section: str = Field(..., examples=["A"])
    email: Optional[EmailStr] = None
    phone: Optional[str] = None


class StudentCreate(StudentBase):
    """Used at registration time — face images are uploaded via a separate multipart endpoint."""
    pass


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    year: Optional[int] = None
    section: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class StudentResponse(MongoBaseModel):
    id: PyObjectId = Field(alias="_id")
    register_no: str
    name: str
    department: str
    year: int
    section: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    is_active: bool = True
    face_enrolled: bool = False          # True once >=1 embedding captured
    enrolled_face_count: int = 0
    created_at: datetime
    updated_at: datetime


class FaceEnrollmentResponse(BaseModel):
    student_id: str
    register_no: str
    images_received: int
    faces_enrolled: int
    faces_rejected: int
    rejection_reasons: List[str] = []
    message: str
