"""
MCP Registry & Executor
"""
import httpx
from typing import Any, Dict

class MCPRegistry:
    def __init__(self, registry_cache: Dict[str, dict] | None = None):
        self._registry = registry_cache or {}
        
    def register_tool(self, tool_id: str, base_url: str, schema: dict):
        self._registry[tool_id] = {
            "base_url": base_url,
            "schema": schema
        }
        
    async def execute_tool(self, tool_id: str, args: dict) -> Any:
        tool = self._registry.get(tool_id)
        if not tool:
            raise ValueError(f"MCP Tool {tool_id} not found in registry")
            
        url = tool["base_url"]
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=args)
            response.raise_for_status()
            return response.json()
