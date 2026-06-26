"""
Frame extraction from uploaded video/image files.

Sampling strategy: extract N frames/second (configurable, default 1 fps) rather
than every frame. For a 3-5 minute classroom video this cuts frames-to-process
from 5000-9000 down to 180-300 — the difference between a 10-minute and
<1-minute processing job, while still catching every student who appears for
more than a second.
"""
import os
from typing import Generator, List

import cv2
import numpy as np
from loguru import logger

from app.core.config import settings

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}


def get_file_type(filepath: str) -> str:
    ext = os.path.splitext(filepath)[1].lower()
    if ext in IMAGE_EXTENSIONS:
        return "image"
    if ext in VIDEO_EXTENSIONS:
        return "video"
    raise ValueError(f"Unsupported file extension: {ext}")


def extract_frames(filepath: str) -> Generator[np.ndarray, None, None]:
    """
    Yields BGR frames (numpy arrays) ready for the face engine.
    Handles both single images (yields the one frame) and videos
    (yields sampled frames at FRAME_SAMPLE_RATE_FPS).
    """
    file_type = get_file_type(filepath)

    if file_type == "image":
        frame = cv2.imread(filepath)
        if frame is None:
            raise ValueError(f"Could not read image file: {filepath}")
        yield frame
        return

    cap = cv2.VideoCapture(filepath)
    if not cap.isOpened():
        raise ValueError(f"Could not open video file: {filepath}")

    native_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    sample_interval = max(1, round(native_fps / settings.FRAME_SAMPLE_RATE_FPS))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    logger.info(
        f"Video: {total_frames} total frames @ {native_fps:.1f}fps. "
        f"Sampling every {sample_interval} frames -> "
        f"~{total_frames // sample_interval} frames to process."
    )

    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % sample_interval == 0:
            yield frame
        frame_idx += 1

    cap.release()


def count_sampled_frames(filepath: str) -> int:
    """Quick estimate for progress-bar purposes without re-decoding the whole video."""
    file_type = get_file_type(filepath)
    if file_type == "image":
        return 1

    cap = cv2.VideoCapture(filepath)
    native_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    sample_interval = max(1, round(native_fps / settings.FRAME_SAMPLE_RATE_FPS))
    return max(1, total_frames // sample_interval)
