"""
Face Matching Service.

Strategy: for the MVP/local-dev scale (hundreds of students), brute-force cosine
similarity in Python is fast enough (<10ms for 1000 students) and requires zero
extra infra. The matcher is written behind a clean interface so swapping to
MongoDB Atlas Vector Search ($vectorSearch aggregation stage) later — needed once
you cross ~5,000+ students or want sub-millisecond lookups — is a drop-in
replacement of `find_best_match`, not a pipeline rewrite.
"""
from dataclasses import dataclass
import re
from typing import List, Optional

import numpy as np
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings


@dataclass
class MatchResult:
    student_id: Optional[str]
    register_no: Optional[str]
    name: Optional[str]
    similarity: float
    is_match: bool


class FaceMatcher:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self._cache: List[dict] = []  # [{student_id, register_no, name, embedding}, ...]

    async def load_enrolled_embeddings(self, department: Optional[str] = None,
                                        year: Optional[int] = None,
                                        section: Optional[str] = None) -> int:
        """
        Loads embeddings for the relevant cohort into memory before a recognition
        session. Scoping by dept/year/section (rather than loading ALL students)
        keeps the candidate pool small and reduces false-positive matches across
        unrelated sections.
        """
        # is_active lives on the STUDENT document, not on face_embeddings —
        # so it must be applied when filtering students, never directly in
        # the face_embeddings query below. (A previous version of this code
        # incorrectly added {"is_active": True} to the embeddings query,
        # which silently matched zero documents since no embedding doc has
        # that field — this is why matching always returned 0 students.)
        student_filter = {"is_active": True}
        if department:
            # Case-insensitive EXACT match — "IT" and "it" are the same
            # department. re.escape guards against department/section names
            # containing regex metacharacters (e.g. "B.Sc", "C++") being
            # misinterpreted as patterns instead of literal text.
            student_filter["department"] = {
                "$regex": f"^{re.escape(department)}$", "$options": "i"
            }
        if year:
            student_filter["year"] = year
        if section:
            student_filter["section"] = {
                "$regex": f"^{re.escape(section)}$", "$options": "i"
            }

        cursor = self.db.students.find(student_filter, {"_id": 1})
        student_ids = [str(doc["_id"]) async for doc in cursor]

        embeddings_query = {"student_id": {"$in": student_ids}}

        self._cache = []
        cursor = self.db.face_embeddings.find(embeddings_query)
        async for doc in cursor:
            self._cache.append(
                {
                    "student_id": doc["student_id"],
                    "embedding": np.array(doc["embedding"], dtype=np.float32),
                }
            )

        # Attach name/register_no via a single batched lookup (avoid N+1 queries)
        if self._cache:
            ids = list({c["student_id"] for c in self._cache})
            students_cursor = self.db.students.find({"_id": {"$in": self._to_object_ids(ids)}})
            student_map = {str(s["_id"]): s async for s in students_cursor}
            for entry in self._cache:
                s = student_map.get(entry["student_id"])
                entry["register_no"] = s["register_no"] if s else "UNKNOWN"
                entry["name"] = s["name"] if s else "UNKNOWN"

        return len(self._cache)

    @staticmethod
    def _to_object_ids(ids: List[str]):
        from bson import ObjectId
        return [ObjectId(i) for i in ids]

    def find_best_match(self, query_embedding: np.ndarray) -> MatchResult:
        """
        Returns the closest enrolled student by cosine similarity, plus whether
        it clears the configured match threshold. Threshold is similarity-based
        (higher = more similar); FACE_MATCH_THRESHOLD in config is expressed as
        the MINIMUM acceptable similarity.
        """
        if not self._cache:
            return MatchResult(None, None, None, 0.0, False)

        best_score = -1.0
        best_entry = None

        for entry in self._cache:
            score = float(np.dot(query_embedding, entry["embedding"]))
            if score > best_score:
                best_score = score
                best_entry = entry

        is_match = best_score >= (1.0 - settings.FACE_MATCH_THRESHOLD)
        # NOTE: FACE_MATCH_THRESHOLD is stored as a "distance-style" tolerance in
        # config for readability (0.45 default ~= cosine similarity >= 0.55 required).
        # Tune via experimentation on your own classroom photos — lighting/angle
        # variance in real classrooms differs from clean enrollment photos.

        if best_entry is None:
            return MatchResult(None, None, None, 0.0, False)

        return MatchResult(
            student_id=best_entry["student_id"],
            register_no=best_entry["register_no"],
            name=best_entry["name"],
            similarity=best_score,
            is_match=is_match,
        )