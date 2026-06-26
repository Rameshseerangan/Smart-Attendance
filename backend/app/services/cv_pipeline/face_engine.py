"""
Face Detection & Recognition Engine.

Uses InsightFace's `buffalo_l` model pack:
  - RetinaFace (detection) — robust to classroom angles/lighting, returns 5-point landmarks
  - ArcFace (recognition)  — outputs 512-dim embeddings, ~99.8% accuracy on LFW benchmark

Why InsightFace over face_recognition/Dlib:
  - Dlib's HOG/CNN detector struggles with non-frontal classroom-angle faces.
  - ArcFace's embedding separability (angular margin loss) gives a cleaner
    similarity-score distribution, which means a more reliable match threshold.

This module is a thin, swappable wrapper — if you later want a custom-trained
model, only this file needs to change. Nothing upstream/downstream should
depend on InsightFace internals directly.
"""
from dataclasses import dataclass
from typing import List, Optional

import numpy as np
from insightface.app import FaceAnalysis
from loguru import logger

from app.core.config import settings


@dataclass
class DetectedFace:
    bbox: List[int]            # [x1, y1, x2, y2] in original frame coordinates
    landmark: np.ndarray        # 5-point facial landmarks
    embedding: np.ndarray       # 512-dim L2-normalized face embedding
    det_score: float            # detector confidence
    cropped_face: np.ndarray    # aligned face crop, used as input to liveness model


class FaceEngine:
    """Singleton-style wrapper around InsightFace — load the model ONCE at startup,
    never per-request (model load takes several seconds and is expensive)."""

    _instance: Optional["FaceEngine"] = None

    def __init__(self):
        logger.info("Loading InsightFace buffalo_l model pack...")
        self.app = FaceAnalysis(
            name="buffalo_l",
            providers=[settings.ONNX_PROVIDER],
        )
        # ctx_id=0 uses GPU if provider is CUDA; -1 forces CPU. det_size controls
        # detector input resolution — 640x640 balances speed vs. small-face recall
        # for a classroom photo where students sit far from the camera.
        self.app.prepare(ctx_id=0, det_size=(640, 640))
        logger.success("InsightFace models loaded.")

    @classmethod
    def get_instance(cls) -> "FaceEngine":
        if cls._instance is None:
            cls._instance = FaceEngine()
        return cls._instance

    def detect_and_encode(self, frame: np.ndarray) -> List[DetectedFace]:
        """
        Runs detection + alignment + embedding extraction on a single BGR frame
        (as read by cv2.imread / cv2.VideoCapture).

        Returns one DetectedFace per face found, filtered by minimum face size
        to discard distant/blurry faces that would produce unreliable embeddings.
        """
        faces = self.app.get(frame)
        results: List[DetectedFace] = []

        for face in faces:
            x1, y1, x2, y2 = face.bbox.astype(int)
            face_width, face_height = x2 - x1, y2 - y1

            if min(face_width, face_height) < settings.DETECTION_MIN_FACE_SIZE:
                continue  # too small/far to trust — avoids false negatives on noise

            cropped = frame[max(0, y1):y2, max(0, x1):x2]
            if cropped.size == 0:
                continue

            results.append(
                DetectedFace(
                    bbox=[int(x1), int(y1), int(x2), int(y2)],
                    landmark=face.kps,
                    embedding=face.normed_embedding,   # already L2-normalized by InsightFace
                    det_score=float(face.det_score),
                    cropped_face=cropped,
                )
            )

        return results

    @staticmethod
    def cosine_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Embeddings are pre-normalized, so dot product == cosine similarity."""
        return float(np.dot(emb1, emb2))


def get_face_engine() -> FaceEngine:
    return FaceEngine.get_instance()
