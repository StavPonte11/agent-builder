"""
BlueprintTest and BlueprintTestRun models.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TimestampedBase


class TestType(str, enum.Enum):
    UNIT = "unit"
    INTEGRATION = "integration"
    EVALUATION = "evaluation"


class TestRunStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"


class BlueprintTest(TimestampedBase):
    __tablename__ = "blueprint_tests"

    blueprint_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("blueprints.id"), nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    test_type: Mapped[TestType] = mapped_column(
        Enum(TestType, name="test_type"), nullable=False
    )
    input_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    expected_output: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    evaluation_criteria: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Optional: Langfuse dataset for multi-sample evaluation
    langfuse_dataset_id: Mapped[str | None] = mapped_column(String(255), nullable=True)


class BlueprintTestRun(TimestampedBase):
    __tablename__ = "blueprint_test_runs"

    blueprint_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("blueprints.id"), nullable=False, index=True
    )
    test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("blueprint_tests.id"), nullable=False
    )
    triggered_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    status: Mapped[TestRunStatus] = mapped_column(
        Enum(TestRunStatus, name="test_run_status"),
        nullable=False,
        default=TestRunStatus.PENDING,
    )
    results: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    langfuse_trace_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ran_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    node_results: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
