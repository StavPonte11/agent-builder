"""
AuthService — JWT RS256 + API Key authentication.
"""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.api_key import APIKey
from app.models.user import User

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
ALGORITHM = "RS256"
API_KEY_PREFIX = "ak_"
TOKEN_TYPE = "Bearer"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    """
    Handles JWT token creation/validation and API key management.
    All methods operate on a single org — callers must pass their org_id.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # ------------------------------------------------------------------
    # Password helpers
    # ------------------------------------------------------------------
    @staticmethod
    def hash_password(plain: str) -> str:
        return pwd_context.hash(plain)

    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        return pwd_context.verify(plain, hashed)

    # ------------------------------------------------------------------
    # JWT
    # ------------------------------------------------------------------
    @staticmethod
    def create_access_token(user_id: uuid.UUID, org_id: uuid.UUID, role: str) -> str:
        """Create a short-lived RS256 access token."""
        expires = datetime.now(timezone.utc) + timedelta(
            minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )
        payload: dict[str, Any] = {
            "sub": str(user_id),
            "org": str(org_id),
            "role": role,
            "exp": expires,
            "iat": datetime.now(timezone.utc),
            "type": "access",
        }
        return jwt.encode(payload, settings.jwt_private_key, algorithm=ALGORITHM)

    @staticmethod
    def create_refresh_token(user_id: uuid.UUID) -> str:
        """Create a long-lived refresh token (stored in Redis on issue)."""
        expires = datetime.now(timezone.utc) + timedelta(
            days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
        )
        payload: dict[str, Any] = {
            "sub": str(user_id),
            "exp": expires,
            "iat": datetime.now(timezone.utc),
            "jti": str(uuid.uuid4()),  # Unique ID for revocation
            "type": "refresh",
        }
        return jwt.encode(payload, settings.jwt_private_key, algorithm=ALGORITHM)

    @staticmethod
    def decode_token(token: str) -> dict[str, Any] | None:
        """Verify and decode a JWT. Returns payload or None on failure."""
        try:
            return jwt.decode(token, settings.jwt_public_key, algorithms=[ALGORITHM])
        except JWTError as e:
            logger.debug("auth.jwt.decode_failed", error=str(e))
            return None

    async def validate_access_token(self, token: str) -> User | None:
        """Validate access token and return the User from the database."""
        payload = self.decode_token(token)
        if payload is None or payload.get("type") != "access":
            return None
        user_id_str: str | None = payload.get("sub")
        if user_id_str is None:
            return None
        try:
            user_id = uuid.UUID(user_id_str)
        except ValueError:
            return None

        result = await self._db.execute(
            select(User).where(User.id == user_id, User.is_deleted.is_(False))
        )
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------
    # API Keys
    # ------------------------------------------------------------------
    @staticmethod
    def _hash_api_key(raw_key: str) -> str:
        """PBKDF2-SHA256 hash of the raw API key."""
        return hashlib.pbkdf2_hmac(
            "sha256",
            raw_key.encode(),
            settings.APP_SECRET_KEY.encode(),
            iterations=100_000,
        ).hex()

    async def create_api_key(
        self,
        user_id: uuid.UUID,
        org_id: uuid.UUID,
        name: str,
        scopes: list[str] | None = None,
    ) -> tuple[str, APIKey]:
        """
        Generate a new API key.
        Returns (raw_key, APIKey model) — the raw key is shown ONCE.
        """
        raw_key = API_KEY_PREFIX + secrets.token_urlsafe(40)
        key_hash = self._hash_api_key(raw_key)
        key_prefix = raw_key[:12]  # e.g. "ak_AbCdEfGh12"

        api_key = APIKey(
            user_id=user_id,
            org_id=org_id,
            key_hash=key_hash,
            key_prefix=key_prefix,
            name=name,
            scopes=scopes or ["*"],
        )
        self._db.add(api_key)
        await self._db.flush()
        return raw_key, api_key

    async def validate_api_key(self, raw_key: str) -> User | None:
        """Validate an API key string and return the associated User."""
        if not raw_key.startswith(API_KEY_PREFIX):
            return None

        key_hash = self._hash_api_key(raw_key)
        result = await self._db.execute(
            select(APIKey).where(
                APIKey.key_hash == key_hash,
                APIKey.is_active.is_(True),
                APIKey.is_deleted.is_(False),
            )
        )
        api_key: APIKey | None = result.scalar_one_or_none()
        if api_key is None:
            return None

        # Check expiry
        if api_key.expires_at and api_key.expires_at < datetime.now(timezone.utc):
            return None

        # Update last_used_at
        api_key.last_used_at = datetime.now(timezone.utc)
        await self._db.flush()

        user_result = await self._db.execute(
            select(User).where(User.id == api_key.user_id, User.is_deleted.is_(False))
        )
        return user_result.scalar_one_or_none()

    async def authenticate_user(self, email: str, password: str) -> User | None:
        """Verify email + password. Returns User or None."""
        result = await self._db.execute(
            select(User).where(User.email == email.lower(), User.is_deleted.is_(False))
        )
        user: User | None = result.scalar_one_or_none()
        if user is None:
            return None
        if not self.verify_password(password, user.hashed_password):
            return None
        return user
