# ============================================================================
# ENUMS
# ============================================================================
from enum import Enum
class BuilderType(str, Enum):
    """Type of builder"""
    WORKFLOW = "workflow"
    AGENT = "agent"


class NodeType(str, Enum):
    """All supported node types"""
    # Common
    START = "start"
    END = "end"
    CONDITION = "condition"

    # Workflow-specific
    TOOL = "tool"
    TRANSFORMATION = "transformation"
    NOTIFICATION = "notification"
    HUMAN_APPROVAL = "human_approval"

    # Agent-specific
    LLM = "llm"
    MEMORY_READ = "memory_read"
    MEMORY_WRITE = "memory_write"
    ROUTER = "router"
    GUARDRAIL = "guardrail"

    # Hybrid (used in both)
    OPERATION = "operation"


class EdgeType(str, Enum):
    """Connection types between nodes"""
    DEFAULT = "default"
    CONDITIONAL = "conditional"
    ERROR = "error"
    PARALLEL = "parallel"


class NodeStatus(str, Enum):
    """Node configuration status"""
    CONFIGURED = "configured"
    NEEDS_INPUT = "needs_input"
    ERROR = "error"


class ValidationSeverity(str, Enum):
    """Validation issue severity"""
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class BuildStatus(str, Enum):
    """Build/Agent status in lifecycle"""
    DRAFT = "draft"
    TESTING = "testing"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    PUBLISHED = "published"
    DEPRECATED = "deprecated"
    REJECTED = "rejected"


class ExecutionStatus(str, Enum):
    """Execution status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class GuardrailType(str, Enum):
    """Types of guardrails"""
    INPUT_CONTENT_FILTER = "input_content_filter"
    OUTPUT_CONTENT_FILTER = "output_content_filter"
    PII_DETECTION = "pii_detection"
    PROMPT_INJECTION = "prompt_injection"
    COST_LIMIT = "cost_limit"
    TOKEN_LIMIT = "token_limit"
    RATE_LIMIT = "rate_limit"