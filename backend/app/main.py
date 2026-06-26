"""
Application entrypoint.

Model loading (InsightFace + liveness CNN) happens via lazy singletons the
first time they're used (see face_engine.py / liveness_detector.py) — NOT at
import time — so `uvicorn app.main:app --reload` doesn't reload multi-GB
models on every code change during development. For production, you may
instead want to warm these up in the lifespan startup hook below; commented
example included.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import mongodb


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---- Startup ----
    await mongodb.connect()

    # Uncomment to eagerly load CV models at startup instead of on first request
    # (trades slower startup for no cold-start lag on the first attendance upload):
    #
    # from app.services.cv_pipeline.face_engine import get_face_engine
    # from app.services.cv_pipeline.liveness_detector import get_liveness_detector
    # get_face_engine()
    # get_liveness_detector()

    logger.info(f"{settings.APP_NAME} started in '{settings.APP_ENV}' mode.")
    yield
    # ---- Shutdown ----
    await mongodb.disconnect()


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-based Smart Attendance & Proxy Detection System for educational institutions",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "app": settings.APP_NAME, "version": "1.0.0"}


@app.get("/health", tags=["Health"])
async def health_check():
    try:
        await mongodb.client.admin.command("ping")
        db_status = "connected"
    except Exception as exc:
        db_status = f"error: {exc}"
    return {"status": "ok", "database": db_status}
