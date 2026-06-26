from datetime import datetime
from typing import Optional

from bson import ObjectId
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import MongoBaseModel, PyObjectId




# ---------------- Faculty ----------------
class FacultyBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    department: str
    email: EmailStr


class FacultyCreate(FacultyBase):
    password: str = Field(..., min_length=6)


class FacultyUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None


class FacultyResponse(MongoBaseModel):
    id: PyObjectId = Field(alias="_id")
    name: str
    department: str
    email: EmailStr
    is_active: bool = True
    created_at: datetime


# ---------------- Subject ----------------
class SubjectBase(BaseModel):
    subject_code: str = Field(..., examples=["CS301"])
    subject_name: str
    department: str
    year: int = Field(..., ge=1, le=5)
    section: str
    faculty_id: str


class SubjectCreate(SubjectBase):
    pass


class SubjectResponse(MongoBaseModel):
    id: PyObjectId = Field(alias="_id")
    subject_code: str
    subject_name: str
    department: str
    year: int
    section: str
    faculty_id: str
    faculty_name: Optional[str] = None
    created_at: datetime

    @field_validator("faculty_id", mode="before")
    @classmethod
    def coerce_faculty_id(cls, v):
        if isinstance(v, ObjectId):
            return str(v)
        return v


# ---------------- Auth ----------------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    name: str