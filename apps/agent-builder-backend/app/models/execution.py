"""
Execution model — every blueprint run (sandbox or production).
"""


import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, String, Boolean, Integer
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlmodel import Field

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


class Execution(TimestampedBase, table=True):
    __tablename__ = "executions"

    blueprint_id: uuid.UUID = Field(
        foreign_key="blueprints.id",
        nullable=False,
        index=True,
        sa_type=UUID(as_uuid=True)
    )
    blueprint_version: int = Field(sa_type=Integer, nullable=False)
    triggered_by: Optional[uuid.UUID] = Field(
        default=None,
        foreign_key="users.id",
        nullable=True,
        sa_type=UUID(as_uuid=True)
    )
    org_id: uuid.UUID = Field(
        foreign_key="organizations.id",
        nullable=False,
        index=True,
        sa_type=UUID(as_uuid=True)
    )
    execution_mode: ExecutionMode = Field(
        sa_type=Enum(ExecutionMode, name="execution_mode"),
        nullable=False
    )
    status: ExecutionStatus = Field(
        sa_type=Enum(ExecutionStatus, name="execution_status"),
        nullable=False,
        default=ExecutionStatus.PENDING,
        index=True,
    )
    input_data: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    output_data: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    # Temporal workflow references
    temporal_workflow_id: Optional[str] = Field(sa_type=String(255), nullable=True, default=None)
    temporal_run_id: Optional[str] = Field(sa_type=String(255), nullable=True, default=None)
    # Langfuse tracing
    langfuse_trace_id: Optional[str] = Field(sa_type=String(255), nullable=True, default=None)
    langfuse_session_id: Optional[str] = Field(sa_type=String(255), nullable=True, default=None)
    started_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        nullable=True
    )
    completed_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        nullable=True
    )
    duration_ms: Optional[int] = Field(sa_type=Integer, nullable=True, default=None)
    # Token usage: {prompt_tokens, completion_tokens, total_tokens, cost_usd}
    token_usage: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    # Per-node execution trace
    node_executions: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    error_details: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    is_sandbox: bool = Field(sa_type=Boolean, nullable=False, default=False)


class ExecutionApproval(TimestampedBase, table=True):
    """Human-in-the-loop approval required at an ApprovalNode."""

    __tablename__ = "execution_approvals"

    execution_id: uuid.UUID = Field(
        foreign_key="executions.id",
        nullable=False,
        index=True,
        sa_type=UUID(as_uuid=True)
    )
    node_id: str = Field(sa_type=String(255), nullable=False)
    requested_by: Optional[uuid.UUID] = Field(
        default=None,
        foreign_key="users.id",
        nullable=True,
        sa_type=UUID(as_uuid=True)
    )

    class ApprovalStatus(str, enum.Enum):
        PENDING = "pending"
        APPROVED = "approved"
        REJECTED = "rejected"
        TIMED_OUT = "timed_out"

    status: ApprovalStatus = Field(
        sa_type=Enum(ApprovalStatus, name="approval_status"),
        nullable=False,
        default=ApprovalStatus.PENDING,
    )
    requested_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        nullable=True
    )
    resolved_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        nullable=True
    )
    resolver_id: Optional[uuid.UUID] = Field(
        default=None,
        foreign_key="users.id",
        nullable=True,
        sa_type=UUID(as_uuid=True)
    )
    context_data: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    resolution_notes: str = Field(sa_type=String(2000), nullable=False, default="")

