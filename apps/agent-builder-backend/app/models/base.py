"""
Shared base model mixin with UUID PK, timestamps, soft delete, and created_by FK.
All domain models inherit from TimestampedBase.
"""


import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TimestampedBase(SQLModel):
    """
    Abstract base for all domain models.
    Provides: UUID primary key, created_at, updated_at, is_deleted.
    """

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        sa_type=UUID(as_uuid=True),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={"server_default": func.now()},
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )
    is_deleted: bool = Field(
        default=False,
        sa_type=Boolean,
        index=True,
    )

