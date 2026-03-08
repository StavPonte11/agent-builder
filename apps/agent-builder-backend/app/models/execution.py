"""
Execution model — every blueprint run (sandbox or production).
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Boolean
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TimestampedBase


class ExecutionMode(str, enum.Enum):
    SANDBOX = "sandbox"
    PRODUCTION = "production"


class ExecutionStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMED_OUT = "timed_out"


class Execution(TimestampedBase):
    __tablename__ = "executions"

    blueprint_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("blueprints.id"), nullable=False, index=True
    )
    blueprint_version: Mapped[int] = mapped_column(Integer, nullable=False)
    triggered_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    execution_mode: Mapped[ExecutionMode] = mapped_column(
        Enum(ExecutionMode, name="execution_mode"), nullable=False
    )
    status: Mapped[ExecutionStatus] = mapped_column(
        Enum(ExecutionStatus, name="execution_status"),
        nullable=False,
        default=ExecutionStatus.PENDING,
        index=True,
    )
    input_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    output_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Temporal workflow references
    temporal_workflow_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    temporal_run_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Langfuse tracing
    langfuse_trace_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    langfuse_session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Token usage: {prompt_tokens, completion_tokens, total_tokens, cost_usd}
    token_usage: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Per-node execution trace
    node_executions: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    error_details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    is_sandbox: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class ExecutionApproval(TimestampedBase):
    """Human-in-the-loop approval required at an ApprovalNode."""

    __tablename__ = "execution_approvals"

    execution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("executions.id"), nullable=False, index=True
    )
    node_id: Mapped[str] = mapped_column(String(255), nullable=False)
    requested_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    class ApprovalStatus(str, enum.Enum):
        PENDING = "pending"
        APPROVED = "approved"
        REJECTED = "rejected"
        TIMED_OUT = "timed_out"

    status: Mapped[ApprovalStatus] = mapped_column(
        Enum(ApprovalStatus, name="approval_status"),
        nullable=False,
        default=ApprovalStatus.PENDING,
    )
    requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    context_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    resolution_notes: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
