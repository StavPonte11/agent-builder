"""
Organization model — top-level multi-tenant namespace.
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import String, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship

from app.models.base import TimestampedBase
from app.core.crypto import CryptoUtils

if TYPE_CHECKING:
    from app.models.user import User


class Organization(TimestampedBase, table=True):
    __tablename__ = "organizations"

    name: str = Field(sa_type=String(255), nullable=False)
    slug: str = Field(sa_type=String(100), nullable=False, unique=True, index=True)
    plan_tier: str = Field(sa_type=String(50), nullable=False, default="free")
    max_users: int = Field(sa_type=Integer, nullable=False, default=10)
    max_executions_per_month: int = Field(sa_type=Integer, nullable=False, default=1000)
    settings: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    provider_keys: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)

    # Relationships
    users: list["User"] = Relationship(
        back_populates="organization",
        sa_relationship_kwargs={"lazy": "noload"}
    )

    def set_provider_keys(self, keys: dict) -> None:
        """Encrypts keys before saving them to the JSONB field."""
        if not keys:
            self.provider_keys = {}
            return
        encrypted = CryptoUtils.encrypt_dict(keys)
        self.provider_keys = {"_encrypted": encrypted}

    def get_decrypted_provider_keys(self) -> dict:
        """Decrypts keys if they have the `_encrypted` wrapper."""
        if not self.provider_keys:
            return {}
        if "_encrypted" in self.provider_keys:
            return CryptoUtils.decrypt_dict(self.provider_keys["_encrypted"])
        # Fallback for old plaintext keys gracefully
        return self.provider_keys

