"""
BasePrompt model — org-level immutable system prompts (admin-write, all-read).
MessageTemplate model — reusable prompt templates with variable interpolation.
Skill model — reusable LangGraph sub-graphs or Python callables.
"""
from __future__ import annotations

import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TimestampedBase


class BasePrompt(TimestampedBase):
    """Org-level immutable system prompts. Only admins can write."""

    __tablename__ = "base_prompts"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(String(50_000), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    metadata: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, name="prompt_metadata"
    )


class MessageTemplate(TimestampedBase):
    """Reusable prompt templates with {{variable}} interpolation."""

    __tablename__ = "message_templates"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    content: Mapped[str] = mapped_column(String(50_000), nullable=False)
    # e.g. [{"name": "user_name", "type": "string", "required": true}]
    variables: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="general")
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class SkillType(str, enum.Enum):
    LLM = "llm"
    TOOL = "tool"
    CODE = "code"
    RETRIEVAL = "retrieval"


class Skill(TimestampedBase):
    """Reusable LangGraph sub-graph or Python callable."""

    __tablename__ = "skills"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    skill_type: Mapped[SkillType] = mapped_column(
        Enum(SkillType, name="skill_type"), nullable=False
    )
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    input_schema: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    output_schema: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    test_results: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
