"""Pydantic schemas for the BasePrompt entity."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class BasePromptCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=50_000)
    meta_data: dict = Field(default_factory=dict)


class BasePromptUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = Field(default=None, min_length=1, max_length=50_000)
    meta_data: dict | None = None


class BasePromptResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    created_by: uuid.UUID
    name: str
    content: str
    version: int
    is_active: bool
    meta_data: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
