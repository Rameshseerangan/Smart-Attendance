"""
Reports & Analytics endpoints.

Absentee List: students absent on a SPECIFIC date/subject.
Defaulter List: students whose OVERALL attendance % falls below a threshold
                 across a date range — this is the list typically used for
                 academic action (detention from exams, parent notification, etc).
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.core.deps import require_role
from app.schemas.attendance import AbsenteeListItem, DefaulterListItem

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])


@router.get("/absentees", response_model=List[AbsenteeListItem])
async def get_absentee_list(
    subject_id: str,
    date: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("faculty", "admin")),
):
    """Absentees for one specific class session."""
    subject = await db.subjects.find_one({"_id": _oid(subject_id)})
    pipeline = [
        {"$match": {"subject_id": subject_id, "date": date, "status": "Absent"}},
    ]
    absentees_cursor = db.attendance.aggregate(pipeline)
    results = []
    async for record in absentees_cursor:
        student = await db.students.find_one({"_id": _oid(record["student_id"])})
        if not student:
            continue
        # For a single-session absentee list, total_classes=1 / attended=0 framing
        results.append(
            AbsenteeListItem(
                student_id=record["student_id"],
                register_no=student["register_no"],
                name=student["name"],
                department=student["department"],
                section=student["section"],
                total_classes=1,
                classes_attended=0,
                absences=1,
                attendance_percent=0.0,
            )
        )
    return results


@router.get("/defaulters", response_model=List[DefaulterListItem])
async def get_defaulter_list(
    subject_id: Optional[str] = None,
    department: Optional[str] = None,
    section: Optional[str] = None,
    threshold_percent: float = Query(75.0, ge=0, le=100),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("faculty", "admin")),
):
    """
    Aggregates ALL historical attendance per student and flags anyone below
    the institution's minimum attendance threshold (commonly 75%).
    """
    match_stage = {}
    if subject_id:
        match_stage["subject_id"] = subject_id

    pipeline = [
        {"$match": match_stage} if match_stage else {"$match": {}},
        {
            "$group": {
                "_id": "$student_id",
                "total": {"$sum": 1},
                "present": {"$sum": {"$cond": [{"$eq": ["$status", "Present"]}, 1, 0]}},
            }
        },
    ]

    results = []
    async for doc in db.attendance.aggregate(pipeline):
        student = await db.students.find_one({"_id": _oid(doc["_id"])})
        if not student:
            continue
        if department and student["department"] != department:
            continue
        if section and student["section"] != section:
            continue

        attendance_percent = round((doc["present"] / doc["total"]) * 100, 2) if doc["total"] else 0.0

        if attendance_percent < threshold_percent:
            results.append(
                DefaulterListItem(
                    student_id=doc["_id"],
                    register_no=student["register_no"],
                    name=student["name"],
                    department=student["department"],
                    section=student["section"],
                    attendance_percent=attendance_percent,
                    threshold_percent=threshold_percent,
                )
            )

    results.sort(key=lambda x: x.attendance_percent)
    return results


@router.get("/subject-summary")
async def get_subject_attendance_summary(
    subject_id: str,
    date: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("faculty", "admin")),
):
    """Quick dashboard tile: present/absent counts for one session."""
    pipeline = [
        {"$match": {"subject_id": subject_id, "date": date}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    counts = {doc["_id"]: doc["count"] async for doc in db.attendance.aggregate(pipeline)}
    return {
        "subject_id": subject_id,
        "date": date,
        "present": counts.get("Present", 0),
        "absent": counts.get("Absent", 0),
        "total": sum(counts.values()),
    }


def _oid(id_str: str):
    from bson import ObjectId
    return ObjectId(id_str)
