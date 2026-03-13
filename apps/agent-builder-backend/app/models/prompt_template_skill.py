"""
BasePrompt model — org-level immutable system prompts (admin-write, all-read).
MessageTemplate model — reusable prompt templates with variable interpolation.
Skill model — reusable LangGraph sub-graphs or Python callables.
"""


import enum
import uuid

from sqlalchemy import Boolean, Enum, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlmodel import Field

from app.models.base import TimestampedBase


class BasePrompt(TimestampedBase, table=True):
    """Org-level immutable system prompts. Only admins can write."""

    __tablename__ = "base_prompts"

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
    content: str = Field(sa_type=String(50_000), nullable=False)
    version: int = Field(sa_type=Integer, nullable=False, default=1)
    is_active: bool = Field(sa_type=Boolean, nullable=False, default=True)
    meta_data: dict = Field(
        sa_type=JSONB,
        nullable=False,
        default_factory=dict,
        sa_column_kwargs={"name": "prompt_metadata"}
    )


class MessageTemplate(TimestampedBase, table=True):
    """Reusable prompt templates with {{variable}} interpolation."""

    __tablename__ = "message_templates"

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
    content: str = Field(sa_type=String(50_000), nullable=False)
    variables: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    category: str = Field(sa_type=String(100), nullable=False, default="general")
    tags: list[str] = Field(sa_type=ARRAY(String), nullable=False, default_factory=list)
    version: int = Field(sa_type=Integer, nullable=False, default=1)
    is_published: bool = Field(sa_type=Boolean, nullable=False, default=False)


class SkillType(str, enum.Enum):
    LLM = "llm"
    TOOL = "tool"
    CODE = "code"
    RETRIEVAL = "retrieval"


class Skill(TimestampedBase, table=True):
    """Reusable LangGraph sub-graph or Python callable."""

    __tablename__ = "skills"

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
    skill_type: SkillType = Field(
        sa_type=Enum(SkillType, name="skill_type"),
        nullable=False
    )
    config: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    input_schema: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    output_schema: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    version: int = Field(sa_type=Integer, nullable=False, default=1)
    is_published: bool = Field(sa_type=Boolean, nullable=False, default=False)
    test_results: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)

