"""Pydantic schemas for the Skill entity."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.prompt_template_skill import SkillType


class SkillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    skill_type: SkillType
    config: dict = Field(default_factory=dict)
    input_schema: dict = Field(default_factory=dict)
    output_schema: dict = Field(default_factory=dict)


class SkillUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    config: dict | None = None
    input_schema: dict | None = None
    output_schema: dict | None = None


class SkillResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    created_by: uuid.UUID
    name: str
    description: str
    skill_type: SkillType
    config: dict
    input_schema: dict
    output_schema: dict
    version: int
    is_published: bool
    test_results: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
