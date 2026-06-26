"""
Anti-Spoofing / Liveness Detection.

Approach: Silent-Face-Anti-Spoofing style lightweight CNN (MiniFASNet) that
classifies a single face crop as real vs. spoof (photo/screen/printout).

Why a single-frame CNN and not blink/motion detection:
  - Classroom video has 30-60 students per frame; you cannot ask each one to
    blink interactively. The model must judge liveness from texture/depth cues
    present in ONE frame (moire patterns from screens, paper texture, reflection
    artifacts, lack of micro-texture in printed photos).
  - This keeps total processing time within your <1 minute target since there's
    no multi-frame temporal analysis needed per face.

Production note: this module expects a pretrained MiniFASNet ONNX/PyTorch
checkpoint placed at ml_models/anti_spoof/. Train/fine-tune on CelebA-Spoof or
your institution's own spoof/live photo dataset for best accuracy — generic
pretrained weights get you ~90-95%; domain fine-tuning (printouts/phone screens
your students would actually try) pushes this toward 98%+.
"""
import os
from typing import Optional

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from loguru import logger

from app.core.config import settings

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "ml_models", "anti_spoof")
MODEL_PATH = os.path.join(MODEL_DIR, "minifasnet.pth")


class MiniFASNet(nn.Module):
    """
    Lightweight CNN classifier head. Architecture kept intentionally simple here;
    swap in the official MiniFASNetV2 backbone for production-grade accuracy —
    this class defines the *interface* the rest of the pipeline depends on.
    """

    def __init__(self, num_classes: int = 2):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 32, 3, stride=2, padding=1), nn.BatchNorm2d(32), nn.ReLU(),
            nn.Conv2d(32, 64, 3, stride=2, padding=1), nn.BatchNorm2d(64), nn.ReLU(),
            nn.Conv2d(64, 128, 3, stride=2, padding=1), nn.BatchNorm2d(128), nn.ReLU(),
            nn.AdaptiveAvgPool2d(1),
        )
        self.classifier = nn.Linear(128, num_classes)

    def forward(self, x):
        x = self.features(x)
        x = torch.flatten(x, 1)
        return self.classifier(x)


class LivenessDetector:
    """Singleton wrapper — load model weights once at startup."""

    _instance: Optional["LivenessDetector"] = None

    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = MiniFASNet().to(self.device)

        if os.path.exists(MODEL_PATH):
            self.model.load_state_dict(torch.load(MODEL_PATH, map_location=self.device))
            logger.success(f"Loaded anti-spoofing weights from {MODEL_PATH}")
        else:
            logger.warning(
                f"No anti-spoofing weights found at {MODEL_PATH}. "
                "Running with UNTRAINED weights — liveness scores are not meaningful "
                "yet. Train/download MiniFASNet weights before production use."
            )
        self.model.eval()

    @classmethod
    def get_instance(cls) -> "LivenessDetector":
        if cls._instance is None:
            cls._instance = LivenessDetector()
        return cls._instance

    def _preprocess(self, face_crop: np.ndarray) -> torch.Tensor:
        face = cv2.resize(face_crop, (80, 80))
        face = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)
        face = face.astype(np.float32) / 255.0
        face = (face - 0.5) / 0.5  # normalize to [-1, 1]
        tensor = torch.from_numpy(face).permute(2, 0, 1).unsqueeze(0)  # NCHW
        return tensor.to(self.device)

    @torch.no_grad()
    def predict_liveness(self, face_crop: np.ndarray) -> float:
        """
        Returns a liveness score in [0, 1] where higher = more likely REAL (live).
        Caller compares this against settings.LIVENESS_THRESHOLD.
        """
        tensor = self._preprocess(face_crop)
        logits = self.model(tensor)
        probs = F.softmax(logits, dim=1)
        live_prob = probs[0, 1].item()  # index 1 = "real" class
        return live_prob

    def is_live(self, face_crop: np.ndarray) -> tuple[bool, float]:
        score = self.predict_liveness(face_crop)
        return score >= settings.LIVENESS_THRESHOLD, score


def get_liveness_detector() -> LivenessDetector:
    return LivenessDetector.get_instance()
