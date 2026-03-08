"""
MCPTool service — CRUD + health check ping.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select

from app.models.mcp_tool import MCPTool, ToolHealthStatus
from app.schemas.mcp_tool import MCPToolCreate, MCPToolUpdate
from app.services.base_service import BaseService


class MCPToolService(BaseService):

    async def list(self) -> list[MCPTool]:
        result = await self._db.execute(
            select(MCPTool).where(
                MCPTool.org_id == self._org_id,
                MCPTool.is_deleted.is_(False),
            )
        )
        return list(result.scalars().all())

    async def get(self, tool_id: uuid.UUID) -> MCPTool:
        return await self._get_by_id(MCPTool, tool_id)

    async def create(self, data: MCPToolCreate) -> MCPTool:
        self._require_builder_or_admin()
        # Ensure tool_id is unique within the org
        existing = await self._db.execute(
            select(MCPTool).where(
                MCPTool.org_id == self._org_id,
                MCPTool.tool_id == data.tool_id,
                MCPTool.is_deleted.is_(False),
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A tool with tool_id '{data.tool_id}' already exists in this org.",
            )
        tool = MCPTool(
            org_id=self._org_id,
            created_by=self._user.id,
            **data.model_dump(),
        )
        self._db.add(tool)
        await self._db.flush()
        return tool

    async def update(self, tool_id: uuid.UUID, data: MCPToolUpdate) -> MCPTool:
        self._require_builder_or_admin()
        tool = await self._get_by_id(MCPTool, tool_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(tool, field, value)
        await self._db.flush()
        return tool

    async def delete(self, tool_id: uuid.UUID) -> None:
        self._require_builder_or_admin()
        tool = await self._get_by_id(MCPTool, tool_id)
        await self._soft_delete(tool)

    async def health_check(self, tool_id: uuid.UUID) -> MCPTool:
        """Ping the MCP tool's base_url and update health_status."""
        self._require_builder_or_admin()
        tool = await self._get_by_id(MCPTool, tool_id)
        now = datetime.now(timezone.utc)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{tool.base_url.rstrip('/')}/health")
            if response.status_code < 500:
                tool.health_status = ToolHealthStatus.HEALTHY
            else:
                tool.health_status = ToolHealthStatus.DEGRADED
        except Exception:
            tool.health_status = ToolHealthStatus.OFFLINE
        tool.last_health_check = now
        await self._db.flush()
        return tool
