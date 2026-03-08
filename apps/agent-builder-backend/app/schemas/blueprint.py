"""Pydantic schemas for Blueprint and BlueprintVersion entities."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.blueprint import BlueprintStatus, BlueprintType


# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------

class BlueprintCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    blueprint_type: BlueprintType = BlueprintType.WORKFLOW
    definition: dict = Field(default_factory=dict)
    base_prompt_id: uuid.UUID | None = None
    config: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)


class BlueprintUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    definition: dict | None = None
    base_prompt_id: uuid.UUID | None = None
    config: dict | None = None
    tags: list[str] | None = None


class BlueprintResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    created_by: uuid.UUID
    name: str
    description: str
    blueprint_type: BlueprintType
    definition: dict
    base_prompt_id: uuid.UUID | None
    config: dict
    status: BlueprintStatus
    version: int
    published_version: int
    parent_id: uuid.UUID | None
    tags: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BlueprintListItem(BaseModel):
    """Lighter response for list endpoints."""
    id: uuid.UUID
    name: str
    description: str
    blueprint_type: BlueprintType
    status: BlueprintStatus
    version: int
    tags: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BlueprintDuplicateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class BlueprintValidateResponse(BaseModel):
    valid: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class BlueprintCostEstimate(BaseModel):
    estimated_tokens_per_run: int
    estimated_cost_usd_per_run: float
    model_breakdown: list[dict]


# ---------------------------------------------------------------------------
# Blueprint Versioning
# ---------------------------------------------------------------------------

class BlueprintVersionResponse(BaseModel):
    id: uuid.UUID
    blueprint_id: uuid.UUID
    version: int
    definition: dict
    published_by: uuid.UUID
    release_notes: str
    is_rollback_target: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class BlueprintRollbackRequest(BaseModel):
    version: int = Field(ge=1)
    release_notes: str = Field(default="", max_length=5000)
