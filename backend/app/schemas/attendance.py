from datetime import date as date_type, datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.common import MongoBaseModel, PyObjectId


class AttendanceStatus(str, Enum):
    PRESENT = "Present"
    ABSENT = "Absent"


class JobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AttendanceRecord(MongoBaseModel):
    id: PyObjectId = Field(alias="_id")
    student_id: str
    register_no: str
    student_name: str
    subject_id: str
    subject_code: str
    date: str            # ISO date string, e.g. "2026-06-24"
    time: str             # ISO time string, e.g. "10:05:32"
    status: AttendanceStatus
    confidence: Optional[float] = None     # recognition confidence score, for audit
    liveness_score: Optional[float] = None  # anti-spoof score, for audit
    marked_by: str        # faculty_id who triggered the session
    session_id: str       # ties record to a specific upload/job
    created_at: datetime


class AttendanceSessionRequest(BaseModel):
    subject_id: str
    date: Optional[str] = None  # defaults to today server-side if omitted


class AttendanceJobResponse(BaseModel):
    job_id: str
    status: JobStatus
    subject_id: str
    date: str
    message: str


class AttendanceJobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress_percent: int = 0
    total_frames_processed: int = 0
    students_recognized: int = 0
    students_flagged_spoof: int = 0
    error_message: Optional[str] = None
    result_summary: Optional[dict] = None


class AbsenteeListItem(BaseModel):
    student_id: str
    register_no: str
    name: str
    department: str
    section: str
    total_classes: int
    classes_attended: int
    absences: int
    attendance_percent: float


class DefaulterListItem(BaseModel):
    student_id: str
    register_no: str
    name: str
    department: str
    section: str
    attendance_percent: float
    threshold_percent: float = 75.0
