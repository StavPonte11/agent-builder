"""
Organization model — top-level multi-tenant namespace.
"""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import String, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TimestampedBase

if TYPE_CHECKING:
    from app.models.user import User


class Organization(TimestampedBase):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    plan_tier: Mapped[str] = mapped_column(String(50), nullable=False, default="free")
    max_users: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    max_executions_per_month: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1000
    )
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # Relationships
    users: Mapped[list["User"]] = relationship(
        "User", back_populates="organization", lazy="noload"
    )
