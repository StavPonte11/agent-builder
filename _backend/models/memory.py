# ============================================================================
# MEMORY & STORAGE
# ============================================================================

from datetime import datetime
from typing import Dict, Any, Optional, Literal
from uuid import uuid4

from pydantic import BaseModel, Field


class MemoryEntry(BaseModel):
    """Entry in agent memory"""

    id: str = Field(default_factory=lambda: str(uuid4()))
    build_id: str
    execution_id: Optional[str] = None

    # Storage
    storage_type: Literal["short_term", "long_term", "vector"]
    storage_backend: Literal["redis", "postgres", "in_memory"]

    # Data
    key: str
    value: Dict[str, Any]

    # Lifecycle
    ttl: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.now)
    expires_at: Optional[datetime] = None
    accessed_count: int = 0
    last_accessed: Optional[datetime] = None
