from fastapi import APIRouter

from app.api.v1.endpoints import admin_db, attendance, auth, faculty, reports, students, subjects

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(students.router)
api_router.include_router(faculty.router)
api_router.include_router(subjects.router)
api_router.include_router(attendance.router)
api_router.include_router(reports.router)
api_router.include_router(admin_db.router)
