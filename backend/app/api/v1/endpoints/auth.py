"""
Auth endpoints. Admin and Faculty share one login flow but are stored in
separate collections — role is determined by which collection the email matched,
and embedded into the JWT so downstream endpoints can enforce RBAC via
Depends(require_role(...)) without a DB lookup on every request.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.core.security import create_access_token, verify_password
from app.schemas.faculty import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    # Check admin collection first, then faculty
    admin = await db.admins.find_one({"email": payload.email})
    if admin and verify_password(payload.password, admin["password_hash"]):
        token = create_access_token(subject=str(admin["_id"]), role="admin")
        return TokenResponse(
            access_token=token, role="admin", user_id=str(admin["_id"]), name=admin["name"]
        )

    faculty = await db.faculty.find_one({"email": payload.email})
    if faculty and verify_password(payload.password, faculty["password_hash"]):
        if not faculty.get("is_active", True):
            raise HTTPException(status_code=403, detail="Faculty account is deactivated")
        token = create_access_token(subject=str(faculty["_id"]), role="faculty")
        return TokenResponse(
            access_token=token, role="faculty", user_id=str(faculty["_id"]), name=faculty["name"]
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
    )
