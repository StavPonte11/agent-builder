from datetime import datetime
from typing import Dict, Any, Optional
from uuid import uuid4

from pydantic import BaseModel, Field

from models.graph_build import BuildDefinition

# ============================================================================
# APPROVAL & PUBLISHING
# ============================================================================


class ApprovalRequest(BaseModel):
    """Request for admin approval to publish"""

    id: str = Field(default_factory=lambda: str(uuid4()))
    build_id: str
    requested_by: str
    requested_at: datetime = Field(default_factory=datetime.now)

    # Validation results
    evaluation_id: str
    passed_tests: bool

    # Review
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    approved: Optional[bool] = None
    rejection_reason: Optional[str] = None

    # Sanity checks
    sanity_check_results: Dict[str, Any] = Field(default_factory=dict)


class BuildVersion(BaseModel):
    """Version snapshot of a build"""

    id: str = Field(default_factory=lambda: str(uuid4()))
    build_id: str
    version: int

    # Snapshot
    build_snapshot: BuildDefinition
    changes: str

    # Performance
    performance_delta: Dict[str, float] = Field(default_factory=dict)

    # Metadata
    created_by: str
    created_at: datetime = Field(default_factory=datetime.now)
    published_at: Optional[datetime] = None
    rollback_from: Optional[int] = None
