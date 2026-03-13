"""Pydantic schemas for the Organization entity."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    plan_tier: str
    max_users: int
    max_executions_per_month: int
    settings: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrganizationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    settings: dict | None = None
    provider_keys: dict | None = None


# Admin-only
class OrganizationAdminUpdate(OrganizationUpdate):
    plan_tier: str | None = Field(default=None, max_length=50)
    max_users: int | None = Field(default=None, ge=1)
    max_executions_per_month: int | None = Field(default=None, ge=0)
