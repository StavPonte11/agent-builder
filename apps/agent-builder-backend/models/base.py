# ============================================================================
# BASE MODELS
# ============================================================================
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NodePosition(BaseModel):
    """2D position on canvas"""

    x: float
    y: float


class NodeMetadata(BaseModel):
    """Metadata about node performance"""

    estimated_cost: Optional[float] = None
    avg_duration: Optional[float] = None
    success_rate: Optional[float] = None
    last_executed: Optional[datetime] = None
