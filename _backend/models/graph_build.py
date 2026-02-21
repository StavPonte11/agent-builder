from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field

from enums.builder_enum import BuilderType, BuildStatus
from models.graph import BuildNode, BuildEdge
from models.guardrails import GuardrailConfig, RateLimitConfig

# ============================================================================
# GRAPH & BUILD DEFINITION
# ============================================================================


class BuildGraphMetadata(BaseModel):
    """Metadata about the build"""

    created_from_nl: Optional[str] = None
    last_modified: datetime = Field(default_factory=datetime.now)
    version: int = 1
    builder_type: BuilderType


class BuildGraph(BaseModel):
    """Complete graph structure (workflow or agent)"""

    nodes: List[BuildNode]
    edges: List[BuildEdge]
    metadata: BuildGraphMetadata


class BuildDefinition(BaseModel):
    """Complete build definition (workflow or agent)"""

    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    description: Optional[str] = None
    builder_type: BuilderType

    # Graph structure
    graph: BuildGraph

    # Agent-specific
    base_prompt_id: Optional[str] = None  # For agents only
    user_prompt: Optional[str] = None  # Agent owner's additions

    # Safety & limits
    guardrails: List[GuardrailConfig] = Field(default_factory=list)
    rate_limits: RateLimitConfig = Field(default_factory=RateLimitConfig)

    # Lifecycle
    status: BuildStatus = BuildStatus.DRAFT
    owner_id: str
    organization_id: str

    # Generated code
    langgraph_code: str = ""

    # Metadata
    version: int = 1
    created_from_template: Optional[str] = None
    natural_language_input: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    published_at: Optional[datetime] = None
