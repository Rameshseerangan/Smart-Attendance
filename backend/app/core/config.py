"""
Centralized configuration module.

Every other module reads settings from here — never read os.environ directly
elsewhere in the codebase. This keeps config validation and defaults in one place.
"""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ---- App ----
    APP_NAME: str = "Smart Attendance & Proxy Detection System"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # ---- MongoDB ----
    MONGO_URI: str
    MONGO_DB_NAME: str = "smart_attendance"

    # ---- JWT Auth ----
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720

    # ---- CORS ----
    CORS_ORIGINS: str = "http://localhost:3000"

    # ---- File storage ----
    UPLOAD_DIR: str = "app/static/uploads"
    MAX_UPLOAD_SIZE_MB: int = 500

    # ---- CV / ML thresholds ----
    FACE_MATCH_THRESHOLD: float = 0.45        # cosine distance; lower = stricter match
    LIVENESS_THRESHOLD: float = 0.60          # spoof-prob cutoff; below = considered live
    LIVENESS_CHECK_ENABLED: bool = True       # set False in .env ONLY for local testing
                                                # with untrained liveness weights — NEVER in
                                                # production, since this disables anti-proxy
                                                # protection entirely.
    FRAME_SAMPLE_RATE_FPS: int = 1            # how many frames/sec to analyze from video
    DETECTION_MIN_FACE_SIZE: int = 40         # px, ignore faces smaller than this (far/blurred)

    # ---- ONNX runtime ----
    ONNX_PROVIDER: str = "CPUExecutionProvider"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance — avoids re-parsing .env on every import."""
    return Settings()


settings = get_settings()