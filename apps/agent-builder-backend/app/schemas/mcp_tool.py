"""Pydantic schemas for the MCPTool entity."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import AnyHttpUrl, BaseModel, Field

from app.models.mcp_tool import ToolHealthStatus


class MCPToolCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    tool_id: str = Field(min_length=1, max_length=100)
    base_url: str = Field(min_length=1, max_length=2000)
    manifest: dict = Field(default_factory=dict)
    auth_config: dict = Field(default_factory=dict)
    capabilities: dict = Field(default_factory=dict)
    version: str = Field(default="1.0.0", max_length=50)


class MCPToolUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    base_url: str | None = Field(default=None, max_length=2000)
    manifest: dict | None = None
    auth_config: dict | None = None
    capabilities: dict | None = None
    version: str | None = Field(default=None, max_length=50)
    is_active: bool | None = None


class MCPToolResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    created_by: uuid.UUID
    name: str
    description: str
    tool_id: str
    base_url: str
    manifest: dict
    capabilities: dict
    version: str
    is_active: bool
    health_status: ToolHealthStatus
    last_health_check: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HealthCheckResponse(BaseModel):
    tool_id: uuid.UUID
    health_status: ToolHealthStatus
    checked_at: datetime
    detail: str | None = None
