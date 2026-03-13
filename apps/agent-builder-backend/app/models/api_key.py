"""
APIKey model — programmatic access credentials.
"""


import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String, Boolean
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlmodel import Field

from app.models.base import TimestampedBase


class APIKey(TimestampedBase, table=True):
    __tablename__ = "api_keys"

    user_id: uuid.UUID = Field(
        foreign_key="users.id",
        nullable=False,
        index=True,
        sa_type=UUID(as_uuid=True)
    )
    org_id: uuid.UUID = Field(
        foreign_key="organizations.id",
        nullable=False,
        index=True,
        sa_type=UUID(as_uuid=True)
    )
    # PBKDF2-SHA256 hash of the raw key (raw key shown to user only once)
    key_hash: str = Field(sa_type=String(255), nullable=False, unique=True)
    # First 8 chars of the raw key for display (e.g. "ak_AbCd12...")
    key_prefix: str = Field(sa_type=String(20), nullable=False)
    name: str = Field(sa_type=String(255), nullable=False)
    scopes: list[str] = Field(sa_type=ARRAY(String), nullable=False, default_factory=list)
    last_used_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        nullable=True
    )
    expires_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        nullable=True
    )
    is_active: bool = Field(sa_type=Boolean, nullable=False, default=True)

