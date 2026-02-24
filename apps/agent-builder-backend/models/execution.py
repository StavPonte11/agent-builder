from datetime import datetime
from typing import Dict, Any, List, Optional, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from enums.builder_enum import ExecutionStatus

# ============================================================================
# EXECUTION
# ============================================================================


class BuildExecution(BaseModel):
    """Execution instance of a build"""

    id: str = Field(default_factory=lambda: str(uuid4()))
    build_id: str
    build_version: int

    # Execution context
    environment: Literal["sandbox", "production"] = "sandbox"
    initiated_by: str

    # Input/output
    input_data: Dict[str, Any] = Field(default_factory=dict)
    output_data: Optional[Dict[str, Any]] = None

    # State & memory
    state_snapshot: Dict[str, Any] = Field(default_factory=dict)
    memory_usage: Dict[str, Any] = Field(default_factory=dict)

    # Execution details
    status: ExecutionStatus = ExecutionStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Metrics
    duration_ms: Optional[int] = None
    tokens_used: int = 0
    cost_usd: float = 0.0

    # Guardrails
    guardrail_checks: List[Dict[str, Any]] = Field(default_factory=list)
    guardrail_violations: List[str] = Field(default_factory=list)

    # Observability
    langfuse_trace_id: Optional[str] = None
    execution_trace: Dict[str, Any] = Field(default_factory=dict)

    # Error handling
    error_message: Optional[str] = None
    error_node_id: Optional[str] = None
