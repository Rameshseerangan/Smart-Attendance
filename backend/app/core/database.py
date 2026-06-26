"""
MongoDB connection lifecycle management.

Uses Motor (async MongoDB driver) so DB calls never block FastAPI's event loop —
critical since face recognition requests need the loop free for concurrent uploads.
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from loguru import logger

from app.core.config import settings


class MongoDB:
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None

    async def connect(self):
        logger.info("Connecting to MongoDB Atlas...")
        self.client = AsyncIOMotorClient(settings.MONGO_URI, uuidRepresentation="standard")
        self.db = self.client[settings.MONGO_DB_NAME]
        # Fail fast on startup if the connection string / network is bad
        await self.client.admin.command("ping")
        logger.success(f"Connected to MongoDB database: {settings.MONGO_DB_NAME}")
        await self._ensure_indexes()

    async def disconnect(self):
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed.")

    async def _ensure_indexes(self):
        """
        Create indexes idempotently on startup. This is the production-safe way to
        guarantee uniqueness/performance constraints without a separate migration step.
        """
        await self.db.students.create_index("register_no", unique=True)
        await self.db.students.create_index([("department", 1), ("year", 1), ("section", 1)])

        await self.db.faculty.create_index("email", unique=True)

        await self.db.attendance.create_index(
            [("student_id", 1), ("subject_id", 1), ("date", 1)], unique=True
        )
        await self.db.attendance.create_index([("date", 1), ("subject_id", 1)])

        await self.db.face_embeddings.create_index("student_id")

        await self.db.subjects.create_index([("subject_code", 1)], unique=True)

        await self.db.attendance_jobs.create_index("job_id", unique=True)

        logger.info("MongoDB indexes ensured.")


mongodb = MongoDB()


def get_database() -> AsyncIOMotorDatabase:
    """Dependency-injectable accessor for the active DB instance."""
    return mongodb.db
