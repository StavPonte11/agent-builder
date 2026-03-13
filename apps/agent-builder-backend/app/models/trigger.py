"""
Trigger model — configurations for executing a published blueprint.
Supports Webhook (external HTTP) and Scheduled (cron) triggers.
"""


import enum
import uuid
from typing import Optional

from sqlalchemy import Enum, String, Boolean
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlmodel import Field

from app.models.base import TimestampedBase


class TriggerType(str, enum.Enum):
    WEBHOOK = "webhook"
    SCHEDULE = "schedule"


class Trigger(TimestampedBase, table=True):
    __tablename__ = "triggers"

    org_id: uuid.UUID = Field(
        foreign_key="organizations.id",
        nullable=False,
        index=True,
        sa_type=UUID(as_uuid=True)
    )
    blueprint_id: uuid.UUID = Field(
        foreign_key="blueprints.id",
        nullable=False,
        index=True,
        sa_type=UUID(as_uuid=True)
    )
    created_by: uuid.UUID = Field(
        foreign_key="users.id",
        nullable=False,
        sa_type=UUID(as_uuid=True)
    )
    name: str = Field(sa_type=String(255), nullable=False)
    trigger_type: TriggerType = Field(
        sa_type=Enum(TriggerType, name="trigger_type"),
        nullable=False,
        index=True
    )
    # config structure varies by type.
    # Webhook: {"secret": "...", "method": "POST"}
    # Schedule: {"cron": "0 * * * *", "timezone": "UTC"} 
    config: dict = Field(sa_type=JSONB, nullable=False, default_factory=dict)
    
    is_active: bool = Field(sa_type=Boolean, nullable=False, default=True)
    
    # Store Temporal schedule_id if this is a cron trigger managed by Temporal
    temporal_schedule_id: Optional[str] = Field(sa_type=String(255), nullable=True, default=None)
