"""
Application configuration via Pydantic Settings (reads from .env).
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All application configuration. Loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", "app/.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_ENV: Literal["development", "staging", "production"] = "development"
    APP_SECRET_KEY: str
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Database
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_TTL_DEFAULT: int = 3600

    # Temporal
    TEMPORAL_HOST: str = "localhost:7233"
    TEMPORAL_NAMESPACE: str = "default"
    TEMPORAL_TASK_QUEUE_EXECUTION: str = "blueprint-execution-queue"
    TEMPORAL_TASK_QUEUE_PUBLISH: str = "publish-pipeline-queue"
    TEMPORAL_TASK_QUEUE_TEST: str = "test-execution-queue"
    TEMPORAL_TASK_QUEUE_NOTIFICATION: str = "notification-queue"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # LLM Providers
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""

    # Langfuse
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_HOST: str = "http://localhost:3100"

    # Safety
    OPENAI_MODERATION_ENABLED: bool = True
    PRESIDIO_ENABLED: bool = True
    INJECTION_DETECTION_ENABLED: bool = True
    INJECTION_LLM_CLASSIFIER_ENABLED: bool = False

    # Auth
    JWT_PRIVATE_KEY_PATH: Path = Path("./keys/private.pem")
    JWT_PUBLIC_KEY_PATH: Path = Path("./keys/public.pem")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT_EXECUTIONS_PER_HOUR: int = 100

    # Feature Flags
    SANDBOX_ENABLED: bool = True
    CODE_NODE_ENABLED: bool = True
    MULTI_ORG_ENABLED: bool = False

    @property
    def jwt_private_key(self) -> str:
        """Read RS256 private key from file."""
        return self.JWT_PRIVATE_KEY_PATH.read_text()

    @property
    def jwt_public_key(self) -> str:
        """Read RS256 public key from file."""
        return self.JWT_PUBLIC_KEY_PATH.read_text()

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton — call this everywhere."""
    return Settings()


# Module-level singleton for convenience
settings: Settings = get_settings()
