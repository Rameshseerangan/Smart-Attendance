"""
One-time setup script: creates the first Admin account so you can log in and
start using the Admin Module (which is otherwise the only way to create
faculty/students — a deliberate chicken-and-egg break, run this once).

Usage:
    cd backend
    python -m app.jobs.seed_admin
"""
import asyncio
from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.core.security import hash_password


async def seed_admin():
    client = AsyncIOMotorClient(settings.MONGO_URI)
    db = client[settings.MONGO_DB_NAME]

    email = input("Admin email: ").strip()
    name = input("Admin name: ").strip()
    password = input("Admin password (min 6 chars): ").strip()

    existing = await db.admins.find_one({"email": email})
    if existing:
        print(f"An admin with email {email} already exists. Aborting.")
        return

    await db.admins.insert_one(
        {
            "name": name,
            "email": email,
            "password_hash": hash_password(password),
            "created_at": datetime.utcnow(),
        }
    )
    print(f"Admin account created for {email}. You can now log in via /api/v1/auth/login")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed_admin())
