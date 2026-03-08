"""Pydantic schemas for the MessageTemplate entity."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class MessageTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    content: str = Field(min_length=1, max_length=50_000)
    variables: dict = Field(default_factory=dict)
    category: str = Field(default="general", max_length=100)
    tags: list[str] = Field(default_factory=list)


class MessageTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    content: str | None = Field(default=None, min_length=1, max_length=50_000)
    variables: dict | None = None
    category: str | None = Field(default=None, max_length=100)
    tags: list[str] | None = None


class MessageTemplateResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    created_by: uuid.UUID
    name: str
    description: str
    content: str
    variables: dict
    category: str
    tags: list[str]
    version: int
    is_published: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
