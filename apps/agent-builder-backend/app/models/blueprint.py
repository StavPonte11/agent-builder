"""
Blueprint model — the core workflow/agent definition stored as React Flow JSON.
"""
from __future__ import annotations

import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Integer, String, Boolean
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TimestampedBase


class BlueprintType(str, enum.Enum):
    WORKFLOW = "workflow"
    AGENT = "agent"


class BlueprintStatus(str, enum.Enum):
    DRAFT = "draft"
    TESTING = "testing"
    PENDING_APPROVAL = "pending_approval"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class Blueprint(TimestampedBase):
    __tablename__ = "blueprints"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    blueprint_type: Mapped[BlueprintType] = mapped_column(
        Enum(BlueprintType, name="blueprint_type"), nullable=False
    )
    # Full React Flow node/edge graph serialized to JSON
    definition: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Compiled LangGraph definition (stored for fast execution)
    compiled_graph: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Optional org-level immutable system prompt
    base_prompt_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("base_prompts.id"), nullable=True
    )
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[BlueprintStatus] = mapped_column(
        Enum(BlueprintStatus, name="blueprint_status"),
        nullable=False,
        default=BlueprintStatus.DRAFT,
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    published_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # For versioning: parent_id points to the blueprint this was forked from
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("blueprints.id"), nullable=True
    )
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    metadata: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, name="blueprint_metadata"
    )


class BlueprintVersion(TimestampedBase):
    """Immutable snapshot of each published version."""

    __tablename__ = "blueprint_versions"

    blueprint_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("blueprints.id"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    definition: Mapped[dict] = mapped_column(JSONB, nullable=False)
    published_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    release_notes: Mapped[str] = mapped_column(String(5000), nullable=False, default="")
    is_rollback_target: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
