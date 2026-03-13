"""
PublishRequest, GuardrailLog, and Notification models.
"""


import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Integer, String, Boolean
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlmodel import Field

from app.models.base import TimestampedBase


# ---------------------------------------------------------------------------
# PublishRequest
# ---------------------------------------------------------------------------
class PublishRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class PublishRequest(TimestampedBase, table=True):
    __tablename__ = "publish_requests"

    blueprint_id: uuid.UUID = Field(
        foreign_key="blueprints.id",
        nullable=False,
        index=True,
        sa_type=UUID(as_uuid=True)
    )
    requested_by: uuid.UUID = Field(
        foreign_key="users.id",
        nullable=False,
        sa_type=UUID(as_uuid=True)
    )
    reviewed_by: Optional[uuid.UUID] = Field(
        default=None,
        foreign_key="users.id",
        nullable=True,
        sa_type=UUID(as_uuid=True)
    )
    status: PublishRequestStatus = Field(
        sa_type=Enum(PublishRequestStatus, name="publish_request_status"),
        nullable=False,
        default=PublishRequestStatus.PENDING,
        index=True,
    )
    version: int = Field(sa_type=Integer, nullable=False)
    release_notes: str = Field(sa_type=String(5000), nullable=False, default="")
    reviewer_notes: str = Field(sa_type=String(5000), nullable=False, default="")
    requested_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        nullable=True
    )
    reviewed_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        nullable=True
    )
    sanity_check_results: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    test_run_results: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)


# ---------------------------------------------------------------------------
# GuardrailLog
# ---------------------------------------------------------------------------
class GuardrailCheckType(str, enum.Enum):
    INPUT_MODERATION = "input_moderation"
    OUTPUT_MODERATION = "output_moderation"
    PII_DETECTION = "pii_detection"
    INJECTION_DETECTION = "injection_detection"
    TOKEN_LIMIT = "token_limit"
    COST_LIMIT = "cost_limit"
    RATE_LIMIT = "rate_limit"


class GuardrailAction(str, enum.Enum):
    ALLOW = "allow"
    BLOCK = "block"
    REDACT = "redact"
    WARN = "warn"


class GuardrailLog(TimestampedBase, table=True):
    __tablename__ = "guardrail_logs"

    execution_id: uuid.UUID = Field(
        foreign_key="executions.id",
        nullable=False,
        index=True,
        sa_type=UUID(as_uuid=True)
    )
    node_id: str = Field(sa_type=String(255), nullable=False)
    check_type: GuardrailCheckType = Field(
        sa_type=Enum(GuardrailCheckType, name="guardrail_check_type"),
        nullable=False
    )
    triggered: bool = Field(sa_type=Boolean, nullable=False)
    action_taken: GuardrailAction = Field(
        sa_type=Enum(GuardrailAction, name="guardrail_action"),
        nullable=False
    )
    details: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    checked_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        nullable=True
    )


# ---------------------------------------------------------------------------
# Notification
# ---------------------------------------------------------------------------
class Notification(TimestampedBase, table=True):
    __tablename__ = "notifications"

    user_id: uuid.UUID = Field(
        foreign_key="users.id",
        nullable=False,
        index=True,
        sa_type=UUID(as_uuid=True)
    )
    org_id: uuid.UUID = Field(
        foreign_key="organizations.id",
        nullable=False,
        index=True,
        sa_type=UUID(as_uuid=True)
    )
    type: str = Field(sa_type=String(100), nullable=False)
    title: str = Field(sa_type=String(500), nullable=False)
    body: str = Field(sa_type=String(5000), nullable=False, default="")
    meta_data: dict = Field(
        sa_type=JSONB,
        nullable=False,
        default_factory=dict,
        sa_column_kwargs={"name": "notification_metadata"}
    )
    is_read: bool = Field(sa_type=Boolean, nullable=False, default=False, index=True)
    read_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        nullable=True
    )

