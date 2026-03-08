"""
WebSocket endpoints for real-time execution streaming.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.redis import subscribe_execution_events
import asyncio

router = APIRouter()

@router.websocket("/executions/{execution_id}/stream")
async def execution_stream(websocket: WebSocket, execution_id: str):
    """
    Connects the frontend to real-time events for a specific execution via Redis Pub/Sub.
    """
    await websocket.accept()
    
    # Simple auth check can be performed here by reading tokens from query params or headers
    
    try:
        # Stream events from Redis right into the websocket
        async for event in subscribe_execution_events(execution_id):
            await websocket.send_json(event)
            
            # If the event indicates completion, we can gracefully close
            if event.get("status") in ("completed", "failed", "cancelled"):
                break
                
    except WebSocketDisconnect:
        # Client disconnected normally
        pass
    except Exception as e:
        await websocket.close(code=1011, reason=str(e))
    else:
        await websocket.close(code=1000)
