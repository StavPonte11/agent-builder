from uuid import UUID
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from blueprint_schema import BlueprintSchema

class BlueprintCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    blueprint_data: BlueprintSchema
    organization_id: Optional[UUID] = None

class BlueprintResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    blueprint_data: Dict[str, Any]
    owner_id: str
    created_at: str
    updated_at: str

class ExecutionCreateRequest(BaseModel):
    blueprint_id: UUID
    input_data: Dict[str, Any]
    environment: str = "production" # sandbox, production

class ExecutionStatusResponse(BaseModel):
    execution_id: UUID
    workflow_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    created_at: str
    completed_at: Optional[str] = None

class ScheduleCreateRequest(BaseModel):
    blueprint_id: UUID
    schedule_id: str
    cron_expression: str
    input_data: Dict[str, Any]
    environment: str = "production"

class ScheduleResponse(BaseModel):
    schedule_id: str
    blueprint_id: UUID
    cron_expression: str
