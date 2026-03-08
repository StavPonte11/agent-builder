"""
MCPTool routes. Full CRUD + health check.
GET    /mcp-tools/
POST   /mcp-tools/
GET    /mcp-tools/{id}
PUT    /mcp-tools/{id}
DELETE /mcp-tools/{id}
POST   /mcp-tools/{id}/health-check
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, status

from app.dependencies import CurrentUser, DbSession
from app.models.mcp_tool import ToolHealthStatus
from app.schemas.mcp_tool import (
    HealthCheckResponse,
    MCPToolCreate,
    MCPToolResponse,
    MCPToolUpdate,
)
from app.services.mcp_tool_service import MCPToolService

router = APIRouter(prefix="/mcp-tools", tags=["MCP Tools"])


@router.get("/", response_model=list[MCPToolResponse])
async def list_mcp_tools(current_user: CurrentUser, db: DbSession) -> list[MCPToolResponse]:
    svc = MCPToolService(db, current_user)
    return [MCPToolResponse.model_validate(t) for t in await svc.list()]


@router.post("/", response_model=MCPToolResponse, status_code=status.HTTP_201_CREATED)
async def create_mcp_tool(body: MCPToolCreate, current_user: CurrentUser, db: DbSession) -> MCPToolResponse:
    svc = MCPToolService(db, current_user)
    return MCPToolResponse.model_validate(await svc.create(body))


@router.get("/{tool_id}", response_model=MCPToolResponse)
async def get_mcp_tool(tool_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> MCPToolResponse:
    svc = MCPToolService(db, current_user)
    return MCPToolResponse.model_validate(await svc.get(tool_id))


@router.put("/{tool_id}", response_model=MCPToolResponse)
async def update_mcp_tool(
    tool_id: uuid.UUID, body: MCPToolUpdate, current_user: CurrentUser, db: DbSession
) -> MCPToolResponse:
    svc = MCPToolService(db, current_user)
    return MCPToolResponse.model_validate(await svc.update(tool_id, body))


@router.delete("/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mcp_tool(tool_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    svc = MCPToolService(db, current_user)
    await svc.delete(tool_id)


@router.post("/{tool_id}/health-check", response_model=HealthCheckResponse)
async def health_check_mcp_tool(
    tool_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> HealthCheckResponse:
    svc = MCPToolService(db, current_user)
    tool = await svc.health_check(tool_id)
    return HealthCheckResponse(
        tool_id=tool.id,
        health_status=tool.health_status,
        checked_at=tool.last_health_check or datetime.now(timezone.utc),
    )
