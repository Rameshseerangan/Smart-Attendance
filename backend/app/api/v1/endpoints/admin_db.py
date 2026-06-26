"""
Admin Module: Database Backup & Restore.

Implementation note: rather than shelling out to `mongodump`/`mongorestore`
(which requires the Mongo tools binary installed and configured separately,
an extra ops dependency), we implement an application-level JSON export/import
across the core collections. This is portable, human-inspectable, and doesn't
require any extra system binaries — appropriate for an institution's IT staff
who may not manage a full MongoDB toolchain.

For very large datasets (10,000+ students with multiple embeddings each),
native `mongodump` is faster — documented as the upgrade path here.
"""
import json
from datetime import datetime
from io import BytesIO

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.core.deps import require_role

router = APIRouter(prefix="/admin/database", tags=["Admin: Backup & Restore"])

BACKUP_COLLECTIONS = [
    "students", "faculty", "subjects", "attendance", "face_embeddings", "admins",
]


class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return {"$oid": str(obj)}
        if isinstance(obj, datetime):
            return {"$date": obj.isoformat()}
        return super().default(obj)


def _decode_mongo_json(obj):
    if isinstance(obj, dict):
        if "$oid" in obj:
            return ObjectId(obj["$oid"])
        if "$date" in obj:
            return datetime.fromisoformat(obj["$date"])
        return {k: _decode_mongo_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_decode_mongo_json(i) for i in obj]
    return obj


@router.get("/backup")
async def backup_database(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("admin")),
):
    """Streams a full JSON backup of all core collections as a downloadable file."""
    backup_data = {"created_at": datetime.utcnow().isoformat(), "collections": {}}

    for collection_name in BACKUP_COLLECTIONS:
        cursor = db[collection_name].find()
        docs = [doc async for doc in cursor]
        backup_data["collections"][collection_name] = docs

    json_bytes = json.dumps(backup_data, cls=MongoJSONEncoder, indent=2).encode("utf-8")
    filename = f"smart_attendance_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"

    return StreamingResponse(
        BytesIO(json_bytes),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/restore")
async def restore_database(
    backup_file: UploadFile = File(...),
    wipe_existing: bool = False,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_role("admin")),
):
    """
    Restores collections from a JSON backup produced by /backup.
    wipe_existing=True clears each target collection before inserting —
    use with caution, this is destructive. Default (False) upserts by _id.
    """
    contents = await backup_file.read()
    try:
        raw = json.loads(contents.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid backup file: not valid JSON")

    if "collections" not in raw:
        raise HTTPException(status_code=400, detail="Invalid backup file format")

    restored_summary = {}

    for collection_name, docs in raw["collections"].items():
        if collection_name not in BACKUP_COLLECTIONS:
            continue

        decoded_docs = [_decode_mongo_json(doc) for doc in docs]

        if wipe_existing:
            await db[collection_name].delete_many({})

        count = 0
        for doc in decoded_docs:
            await db[collection_name].update_one(
                {"_id": doc["_id"]}, {"$set": doc}, upsert=True
            )
            count += 1

        restored_summary[collection_name] = count

    return {"message": "Database restored successfully", "restored": restored_summary}
