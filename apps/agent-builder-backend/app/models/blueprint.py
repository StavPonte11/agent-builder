"""
Blueprint model — the core workflow/agent definition stored as React Flow JSON.
"""


import enum
import uuid
from typing import Optional

from sqlalchemy import Enum, String, Boolean, Integer
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlmodel import Field

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


class Blueprint(TimestampedBase, table=True):
    __tablename__ = "blueprints"

    org_id: uuid.UUID = Field(
        foreign_key="organizations.id",
        nullable=False,
        index=True,
        sa_type=UUID(as_uuid=True)
    )
    created_by: uuid.UUID = Field(
        foreign_key="users.id",
        nullable=False,
        sa_type=UUID(as_uuid=True)
    )
    name: str = Field(sa_type=String(255), nullable=False)
    description: str = Field(sa_type=String(2000), nullable=False, default="")
    blueprint_type: BlueprintType = Field(
        sa_type=Enum(BlueprintType, name="blueprint_type"),
        nullable=False
    )
    # Full React Flow node/edge graph serialized to JSON
    definition: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    # Compiled LangGraph definition (stored for fast execution)
    compiled_graph: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    # Optional org-level immutable system prompt
    base_prompt_id: Optional[uuid.UUID] = Field(
        default=None,
        foreign_key="base_prompts.id",
        nullable=True,
        sa_type=UUID(as_uuid=True)
    )
    config: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    status: BlueprintStatus = Field(
        sa_type=Enum(BlueprintStatus, name="blueprint_status"),
        nullable=False,
        default=BlueprintStatus.DRAFT,
        index=True,
    )
    version: int = Field(sa_type=Integer, nullable=False, default=1)
    published_version: int = Field(sa_type=Integer, nullable=False, default=0)
    # For versioning: parent_id points to the blueprint this was forked from
    parent_id: Optional[uuid.UUID] = Field(
        default=None,
        foreign_key="blueprints.id",
        nullable=True,
        sa_type=UUID(as_uuid=True)
    )
    tags: list[str] = Field(sa_type=ARRAY(String), nullable=False, default_factory=list)
    meta_data: dict = Field(
        sa_type=JSONB,
        nullable=False,
        default_factory=dict,
        sa_column_kwargs={"name": "blueprint_metadata"}
    )


class BlueprintVersion(TimestampedBase, table=True):
    """Immutable snapshot of each published version."""

    __tablename__ = "blueprint_versions"

    blueprint_id: uuid.UUID = Field(
        foreign_key="blueprints.id",
        nullable=False,
        index=True,
        sa_type=UUID(as_uuid=True)
    )
    version: int = Field(sa_type=Integer, nullable=False)
    definition: dict = Field(sa_type=JSONB, nullable=False)
    published_by: uuid.UUID = Field(
        foreign_key="users.id",
        nullable=False,
        sa_type=UUID(as_uuid=True)
    )
    release_notes: str = Field(sa_type=String(5000), nullable=False, default="")
    is_rollback_target: bool = Field(sa_type=Boolean, nullable=False, default=True)

