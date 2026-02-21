from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator
from pydantic.v1 import PositiveInt

from enums.builder_enum import GuardrailType
from enums.guardrails import GuardrailSeverity


# ============================================================================
# PROMPTS & GUARDRAILS
# ============================================================================


class BasePrompt(BaseModel):
    """Organization-level immutable base prompt"""

    id: str = Field(default_factory=lambda: str(uuid4()))
    organization_id: str
    content: str
    version: int = 1
    is_active: bool = True
    created_by: str  # System admin user ID
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        json_schema_extra = {
            "example": {
                "content": "You are a helpful AI assistant. Follow these rules:\n1. Be truthful\n2. Be safe\n3. Respect privacy",
                "organization_id": "org_123",
            }
        }


class GuardrailConfig(BaseModel):
    """Guardrail configuration"""

    type: GuardrailType
    enabled: bool = True
    config: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        json_schema_extra = {
            "example": {
                "type": "pii_detection",
                "enabled": True,
                "config": {
                    "detect_email": True,
                    "detect_phone": True,
                    "detect_ssn": True,
                    "redact": True,
                },
            }
        }


class RateLimitConfig(BaseModel):
    """
    Rate limiting configuration.
    Constraints are enforced at the field level for better performance.
    """

    requests_per_minute: PositiveInt = 60
    requests_per_hour: PositiveInt = 1000
    requests_per_day: PositiveInt = 10000
    tokens_per_request: PositiveInt = 4000
    tokens_per_minute: PositiveInt = 40000
    max_concurrent_executions: PositiveInt = 5

    # If you still want a broad validator for extra logic (like comparing fields):
    @classmethod
    @field_validator("*", mode="after")
    def extra_validation_if_needed(cls, v: int) -> int:
        # The gt=0 check above already handles the "positive" requirement
        return v


class GuardrailResult(BaseModel):
    passed: bool
    violations: List[str]
    severity: GuardrailSeverity
    details: Dict[str, Any] = {}
    redacted_text: Optional[str] = None
