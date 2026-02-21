from fastapi import APIRouter

router = APIRouter(prefix="/api/tools", tags=["tools"])

@router.get("/mcp")
async def list_mcp_tools():
    """Query active MCP servers (mocked)."""
    return [
        {"id": "google-drive-list", "server": "google-drive", "name": "list_files", "description": "List files in Google Drive"},
        {"id": "slack-send", "server": "slack", "name": "send_message", "description": "Send a Slack message"},
        {"id": "calculator-add", "server": "local-tools", "name": "add", "description": "Add two numbers"},
        {"id": "geojson-generator", "server": "local-tools", "name": "generate_geojson", "description": "Generates a valid GeoJSON FeatureCollection given a natural language paragraph describing locations, units, and events."}
    ]
