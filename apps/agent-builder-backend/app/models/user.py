"""
User model with roles and preferences.
"""


import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, String, Boolean
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlmodel import Field, Relationship

from app.models.base import TimestampedBase

if TYPE_CHECKING:
    from app.models.organization import Organization


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    BUILDER = "builder"
    VIEWER = "viewer"


class User(TimestampedBase, table=True):
    __tablename__ = "users"

    org_id: uuid.UUID = Field(
        foreign_key="organizations.id",
        nullable=False,
        index=True,
        sa_type=UUID(as_uuid=True)
    )
    email: str = Field(sa_type=String(320), nullable=False, unique=True, index=True)
    hashed_password: str = Field(sa_type=String(255), nullable=False)
    role: UserRole = Field(
        sa_type=Enum(UserRole, name="user_role"),
        nullable=False,
        default=UserRole.BUILDER
    )
    is_active: bool = Field(sa_type=Boolean, nullable=False, default=True)
    last_login: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        nullable=True
    )
    preferences: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)

    # Relationships
    organization: Optional["Organization"] = Relationship(
        back_populates="users",
        sa_relationship_kwargs={"lazy": "noload"}
    )

