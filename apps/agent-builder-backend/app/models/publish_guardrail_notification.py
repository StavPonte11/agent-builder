"""
PublishRequest, GuardrailLog, and Notification models.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Boolean
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TimestampedBase


# ---------------------------------------------------------------------------
# PublishRequest
# ---------------------------------------------------------------------------
class PublishRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class PublishRequest(TimestampedBase):
    __tablename__ = "publish_requests"

    blueprint_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("blueprints.id"), nullable=False, index=True
    )
    requested_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    status: Mapped[PublishRequestStatus] = mapped_column(
        Enum(PublishRequestStatus, name="publish_request_status"),
        nullable=False,
        default=PublishRequestStatus.PENDING,
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    release_notes: Mapped[str] = mapped_column(String(5000), nullable=False, default="")
    reviewer_notes: Mapped[str] = mapped_column(String(5000), nullable=False, default="")
    requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sanity_check_results: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    test_run_results: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


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


class GuardrailLog(TimestampedBase):
    __tablename__ = "guardrail_logs"

    execution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("executions.id"), nullable=False, index=True
    )
    node_id: Mapped[str] = mapped_column(String(255), nullable=False)
    check_type: Mapped[GuardrailCheckType] = mapped_column(
        Enum(GuardrailCheckType, name="guardrail_check_type"), nullable=False
    )
    triggered: Mapped[bool] = mapped_column(Boolean, nullable=False)
    action_taken: Mapped[GuardrailAction] = mapped_column(
        Enum(GuardrailAction, name="guardrail_action"), nullable=False
    )
    details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    checked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


# ---------------------------------------------------------------------------
# Notification
# ---------------------------------------------------------------------------
class Notification(TimestampedBase):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(String(5000), nullable=False, default="")
    metadata: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, name="notification_metadata"
    )
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
