"""
Generic tools route for UI.
Provides real functional demo tools backed by public HTTP APIs.
"""
from __future__ import annotations

import httpx
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.dependencies import CurrentUser, DbSession
from app.services.mcp_tool_service import MCPToolService

router = APIRouter(prefix="/tools", tags=["Tools"])

# ─── Built-in demo tools definition ───────────────────────────────────────────

DEMO_TOOLS = [
    {
        "id": "demo-weather-lookup",
        "name": "weather_lookup",
        "display_name": "Weather Lookup",
        "description": "Fetch current weather data for any city using the public wttr.in API (no API key needed)",
        "tool_type": "http",
        "endpoint_url": "https://wttr.in/{city}?format=j1",
        "parameters_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "City name (e.g. 'London', 'Tel Aviv', 'New York')"},
            },
            "required": ["city"]
        }
    },
    {
        "id": "demo-ip-geolocation",
        "name": "ip_geolocation",
        "display_name": "IP Geolocation",
        "description": "Geolocate any IP address to country, city, timezone and coordinates using ipapi.co (no API key needed)",
        "tool_type": "http",
        "endpoint_url": "https://ipapi.co/{ip}/json/",
        "parameters_schema": {
            "type": "object",
            "properties": {
                "ip": {"type": "string", "description": "IPv4 address to look up (e.g. '8.8.8.8')"},
            },
            "required": ["ip"]
        }
    },
    {
        "id": "demo-uuid-generator",
        "name": "uuid_generator",
        "display_name": "UUID Generator",
        "description": "Generate one or more random UUID v4 values using httpbin (no API key needed)",
        "tool_type": "http",
        "endpoint_url": "https://httpbin.org/uuid",
        "parameters_schema": {
            "type": "object",
            "properties": {
                "count": {"type": "integer", "description": "Number of UUIDs to generate (1-10)", "default": 1},
            },
            "required": []
        }
    },
    {
        "id": "demo-json-placeholder",
        "name": "fetch_post",
        "display_name": "Fetch Post",
        "description": "Fetch a sample blog post by ID from JSONPlaceholder demo API (no API key needed)",
        "tool_type": "http",
        "endpoint_url": "https://jsonplaceholder.typicode.com/posts/{post_id}",
        "parameters_schema": {
            "type": "object",
            "properties": {
                "post_id": {"type": "integer", "description": "Post ID (1-100)", "default": 1},
            },
            "required": ["post_id"]
        }
    },
]


@router.get("/")
async def list_all_tools(current_user: CurrentUser, db: DbSession) -> list[dict]:
    """List all available tools - demo tools + any registered MCP tools."""
    tools = list(DEMO_TOOLS)
    
    # Append any real registered MCP tools  
    try:
        svc = MCPToolService(db, current_user)
        mcp_tools = await svc.list()
        for t in mcp_tools:
            tools.append({
                "id": str(t.id),
                "name": t.name,
                "display_name": getattr(t, 'display_name', t.name),
                "description": t.description,
                "tool_type": t.tool_type,
                "endpoint_url": getattr(t, 'endpoint_url', None),
                "parameters_schema": t.configuration
            })
    except Exception:
        pass
        
    return tools


class ToolCallRequest(BaseModel):
    tool_id: str
    parameters: dict = {}


@router.post("/call")
async def call_tool(body: ToolCallRequest, current_user: CurrentUser, db: DbSession):
    """
    Execute a registered demo tool with the provided parameters.
    For demo tools, makes real HTTP requests to public APIs.
    """
    # Find the tool definition
    tool = next((t for t in DEMO_TOOLS if t["id"] == body.tool_id or t["name"] == body.tool_id), None)
    
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool '{body.tool_id}' not found")
    
    endpoint = tool.get("endpoint_url", "")
    params = body.parameters or {}
    
    # Substitute path parameters
    try:
        url = endpoint.format(**params)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing required parameter: {e}")
    
    # Handle tool-specific transformations
    tool_name = tool["name"]
    
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        try:
            if tool_name == "weather_lookup":
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                current = data.get("current_condition", [{}])[0]
                return {
                    "success": True,
                    "tool": tool_name,
                    "city": params.get("city"),
                    "result": {
                        "temp_c": current.get("temp_C"),
                        "temp_f": current.get("temp_F"),
                        "feels_like_c": current.get("FeelsLikeC"),
                        "humidity": current.get("humidity"),
                        "description": current.get("weatherDesc", [{}])[0].get("value"),
                        "wind_speed_kmph": current.get("windspeedKmph"),
                        "visibility_km": current.get("visibility"),
                    }
                }
            
            elif tool_name == "ip_geolocation":
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                return {
                    "success": True,
                    "tool": tool_name,
                    "ip": params.get("ip"),
                    "result": {
                        "country": data.get("country_name"),
                        "country_code": data.get("country_code"),
                        "region": data.get("region"),
                        "city": data.get("city"),
                        "timezone": data.get("timezone"),
                        "latitude": data.get("latitude"),
                        "longitude": data.get("longitude"),
                        "org": data.get("org"),
                    }
                }
            
            elif tool_name == "uuid_generator":
                resp = await client.get("https://httpbin.org/uuid")
                resp.raise_for_status()
                single_uuid = resp.json().get("uuid")
                count = min(int(params.get("count", 1)), 10)
                uuids = [single_uuid]
                # Generate any extra UUIDs locally
                for _ in range(count - 1):
                    uuids.append(str(uuid.uuid4()))
                return {
                    "success": True,
                    "tool": tool_name,
                    "result": {"uuids": uuids, "count": len(uuids)}
                }
            
            elif tool_name == "fetch_post":
                resp = await client.get(url)
                resp.raise_for_status()
                return {
                    "success": True,
                    "tool": tool_name,
                    "result": resp.json()
                }
            
            else:
                # Generic HTTP GET fallback
                resp = await client.get(url)
                resp.raise_for_status()
                return {"success": True, "tool": tool_name, "result": resp.json()}
        
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Tool API returned {e.response.status_code}: {e.response.text[:200]}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Tool API unreachable: {str(e)}")
