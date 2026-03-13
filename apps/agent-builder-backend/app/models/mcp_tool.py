"""
MCPTool model — external tool integrations via Model Context Protocol.
"""


import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, String, Boolean
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlmodel import Field

from app.models.base import TimestampedBase


class ToolHealthStatus(str, enum.Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    OFFLINE = "offline"


class MCPTool(TimestampedBase, table=True):
    __tablename__ = "mcp_tools"

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
    # Unique identifier within the org (e.g. "slack", "github")
    tool_id: str = Field(sa_type=String(100), nullable=False, index=True)
    manifest: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    base_url: str = Field(sa_type=String(2000), nullable=False)
    # Auth config stored encrypted at the application layer
    auth_config: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    is_active: bool = Field(sa_type=Boolean, nullable=False, default=True)
    version: str = Field(sa_type=String(50), nullable=False, default="1.0.0")
    capabilities: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    health_status: ToolHealthStatus = Field(
        sa_type=Enum(ToolHealthStatus, name="tool_health_status"),
        nullable=False,
        default=ToolHealthStatus.HEALTHY,
    )
    last_health_check: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        nullable=True
    )

