# ============================================================================
# API REQUEST/RESPONSE MODELS
# ============================================================================
from typing import Dict, Any, List, Optional, Literal

from pydantic import BaseModel, Field

from enums.builder_enum import ValidationSeverity, ExecutionStatus, BuilderType
from models.graph_build import BuildDefinition, BuildGraph



class CreateBuildRequest(BaseModel):
    """Request to create new build"""

    name: str
    description: Optional[str] = None
    builder_type: BuilderType
    natural_language: Optional[str] = None
    template_id: Optional[str] = None
    owner_id: str
    organization_id: str


class CreateBuildResponse(BaseModel):
    """Response after creating build"""

    build: BuildDefinition
    build_id: str


class UpdateGraphRequest(BaseModel):
    """Request to update build graph"""

    graph: BuildGraph


class UpdateGraphResponse(BaseModel):
    """Response after updating graph"""

    build: BuildDefinition
    validation: "ValidationResult"
    langgraph_code: str


class ExecuteRequest(BaseModel):
    """Request to execute build"""

    build_id: str
    input_data: Dict[str, Any] = Field(default_factory=dict)
    environment: Literal["sandbox", "production"] = "sandbox"


class ExecuteResponse(BaseModel):
    """Response after starting execution"""

    execution_id: str
    status: ExecutionStatus
    langfuse_trace_url: Optional[str] = None


class ValidationIssue(BaseModel):
    """Validation issue"""

    severity: ValidationSeverity
    node_id: Optional[str] = None
    message: str
    suggestion: Optional[str] = None
    auto_fix_available: bool = False


class ValidationResult(BaseModel):
    """Validation result"""

    status: Literal["valid", "warnings", "errors"]
    issues: List[ValidationIssue] = Field(default_factory=list)
    estimated_cost: float = 0.0
    estimated_duration: float = 0.0
    estimated_tokens: int = 0


class PublishRequest(BaseModel):
    """Request to publish build"""

    build_id: str
    evaluation_id: str
    notes: Optional[str] = None


class PublishResponse(BaseModel):
    """Response after publish request"""

    approval_request_id: str
    status: Literal["pending_approval", "auto_approved", "rejected"]
    message: str


# Update forward references
UpdateGraphResponse.model_rebuild()
