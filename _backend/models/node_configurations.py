from typing import Dict, Any, List, Optional, Literal

from pydantic import BaseModel, Field

from enums.builder_enum import GuardrailType

# ============================================================================
# NODE CONFIGURATIONS
# ============================================================================


class LLMNodeConfig(BaseModel):
    """Configuration for LLM node"""

    provider: Literal["openai"] = "openai"
    model: str = "gpt-4"
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=1000, gt=0)
    system_prompt: str = ""
    user_prompt_template: str = ""
    stop_sequences: List[str] = Field(default_factory=list)
    response_format: Optional[str] = None  # "json", "text"
    streaming: bool = False


class ToolNodeConfig(BaseModel):
    """Configuration for tool execution"""

    tool_name: str
    tool_type: Literal["api", "database", "file", "custom"]
    parameters: Dict[str, Any] = Field(default_factory=dict)
    timeout: int = 30
    retry_on_failure: bool = False
    max_retries: int = 3


class MemoryNodeConfig(BaseModel):
    """Configuration for memory operations"""

    operation: Literal["read", "write", "update", "delete"]
    memory_type: Literal["short_term", "long_term", "vector"]
    storage_backend: Literal["redis", "postgres", "in_memory"]
    key_template: str = ""
    value_template: Optional[str] = None
    ttl: Optional[int] = None  # Time to live in seconds


class GuardrailNodeConfig(BaseModel):
    """Configuration for guardrail checks"""

    guardrail_type: GuardrailType
    enabled: bool = True
    config: Dict[str, Any] = Field(default_factory=dict)
    fail_on_violation: bool = True
    log_violations: bool = True


class RouterNodeConfig(BaseModel):
    """Configuration for dynamic routing"""

    routing_strategy: Literal["llm_based", "rule_based", "semantic"]
    routes: Dict[str, str] = Field(default_factory=dict)  # {condition: target_node}
    default_route: Optional[str] = None
    llm_config: Optional[LLMNodeConfig] = None


class ConditionalNodeConfig(BaseModel):
    """Configuration for conditional branching"""

    condition_type: Literal["python", "jinja2", "simple"]
    condition: str
    true_branch: str
    false_branch: str
