from typing import Dict, Any, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator, model_validator

from enums.builder_enum import NodeType, NodeStatus, EdgeType
from models.base import NodeMetadata, NodePosition
from models.node_configurations import (
    LLMNodeConfig,
    ToolNodeConfig,
    MemoryNodeConfig,
    GuardrailNodeConfig,
    RouterNodeConfig,
    ConditionalNodeConfig,
)

# ============================================================================
# GRAPH NODES & EDGES
# ============================================================================


class BuildNode(BaseModel):
    """Universal node for workflows and agents using Pydantic V2 standards."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    type: NodeType
    label: str
    description: Optional[str] = None
    position: NodePosition
    status: NodeStatus = NodeStatus.CONFIGURED

    # Configuration based on type - Using Optional/None for clarity
    llm_config: Optional[LLMNodeConfig] = None
    tool_config: Optional[ToolNodeConfig] = None
    memory_config: Optional[MemoryNodeConfig] = None
    guardrail_config: Optional[GuardrailNodeConfig] = None
    router_config: Optional[RouterNodeConfig] = None
    conditional_config: Optional[ConditionalNodeConfig] = None

    # Generic parameters and Metadata
    parameters: Dict[str, Any] = Field(default_factory=dict)
    metadata: NodeMetadata = Field(default_factory=NodeMetadata)

    @model_validator(mode="after")
    def validate_node_configuration(self) -> "BuildNode":
        """
        Ensures the configuration object provided matches the declared NodeType.
        In V2, 'model_validator' is the preferred way to handle logic
        involving multiple fields.
        """
        if self.type == NodeType.LLM and self.llm_config is None:
            raise ValueError("An LLM node must provide 'llm_config'")

        if self.type == NodeType.TOOL and self.tool_config is None:
            raise ValueError("A Tool node must provide 'tool_config'")

        return self

    # Example of a modern field-specific validator
    @classmethod
    @field_validator("id", mode="before")
    def ensure_id_string(cls, v: Any) -> str:
        """Coerces ID to string if it comes in as a UUID object."""
        return str(v) if v else str(uuid4())


class BuildEdge(BaseModel):
    """Connection between nodes"""

    id: str = Field(default_factory=lambda: str(uuid4()))
    source: str
    target: str
    type: EdgeType = EdgeType.DEFAULT
    condition: Optional[str] = None
    label: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
