"""
MCPTool model — external tool integrations via Model Context Protocol.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Boolean
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TimestampedBase


class ToolHealthStatus(str, enum.Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    OFFLINE = "offline"


class MCPTool(TimestampedBase):
    __tablename__ = "mcp_tools"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    # Unique identifier within the org (e.g. "slack", "github")
    tool_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    manifest: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    base_url: Mapped[str] = mapped_column(String(2000), nullable=False)
    # Auth config stored encrypted at the application layer
    auth_config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    version: Mapped[str] = mapped_column(String(50), nullable=False, default="1.0.0")
    capabilities: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    health_status: Mapped[ToolHealthStatus] = mapped_column(
        Enum(ToolHealthStatus, name="tool_health_status"),
        nullable=False,
        default=ToolHealthStatus.HEALTHY,
    )
    last_health_check: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
