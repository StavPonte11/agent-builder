"""
BlueprintTest and BlueprintTestRun models.
"""


import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Float, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlmodel import Field

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


class BlueprintTest(TimestampedBase, table=True):
    __tablename__ = "blueprint_tests"

    blueprint_id: uuid.UUID = Field(
        foreign_key="blueprints.id",
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
    test_type: TestType = Field(
        sa_type=Enum(TestType, name="test_type"),
        nullable=False
    )
    input_data: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    expected_output: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    evaluation_criteria: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    # Optional: Langfuse dataset for multi-sample evaluation
    langfuse_dataset_id: Optional[str] = Field(sa_type=String(255), nullable=True, default=None)


class BlueprintTestRun(TimestampedBase, table=True):
    __tablename__ = "blueprint_test_runs"

    blueprint_id: uuid.UUID = Field(
        foreign_key="blueprints.id",
        nullable=False,
        index=True,
        sa_type=UUID(as_uuid=True)
    )
    test_id: uuid.UUID = Field(
        foreign_key="blueprint_tests.id",
        nullable=False,
        sa_type=UUID(as_uuid=True)
    )
    triggered_by: uuid.UUID = Field(
        foreign_key="users.id",
        nullable=False,
        sa_type=UUID(as_uuid=True)
    )
    status: TestRunStatus = Field(
        sa_type=Enum(TestRunStatus, name="test_run_status"),
        nullable=False,
        default=TestRunStatus.PENDING,
    )
    results: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    score: Optional[float] = Field(sa_type=Float, nullable=True, default=None)
    langfuse_trace_id: Optional[str] = Field(sa_type=String(255), nullable=True, default=None)
    duration_ms: Optional[int] = Field(sa_type=Integer, nullable=True, default=None)
    ran_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        nullable=True
    )
    node_results: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)

