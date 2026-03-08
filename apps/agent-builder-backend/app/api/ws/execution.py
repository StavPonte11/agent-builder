"""
WebSocket endpoint for real-time execution streaming.
Subscribes to Redis pub/sub channel and forwards events to the browser client.

Message types (from spec):
  node_started | node_output | node_completed | node_error | guardrail_triggered |
  approval_required | execution_completed | execution_failed
"""
from __future__ import annotations

import asyncio
import json

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.redis_client import get_redis_client

logger = structlog.get_logger()

ws_router = APIRouter(tags=["WebSocket"])

# How many messages to replay on reconnect
REPLAY_LIMIT = 50


@ws_router.websocket("/ws/executions/{execution_id}")
async def execution_ws(websocket: WebSocket, execution_id: str) -> None:
    """
    Stream real-time execution events to the connected browser client.

    1. Accept the WebSocket connection
    2. Replay the last REPLAY_LIMIT messages from Redis Stream (for reconnects)
    3. Subscribe to Redis Pub/Sub channel exec:{execution_id}
    4. Forward all messages to the client until disconnect
    """
    await websocket.accept()
    logger.info("ws.execution.connected", execution_id=execution_id)

    redis = await get_redis_client()
    channel_name = f"exec:{execution_id}"
    stream_key = f"exec_stream:{execution_id}"

    try:
        # ----------------------------------------------------------------
        # 1. Replay recent messages from Redis Stream
        # ----------------------------------------------------------------
        try:
            recent = await redis.xrevrange(stream_key, count=REPLAY_LIMIT)
            for _msg_id, fields in reversed(recent):
                payload = fields.get("data", "{}")
                await websocket.send_text(payload)
        except Exception as e:
            logger.warning("ws.execution.replay_failed", error=str(e))

        # ----------------------------------------------------------------
        # 2. Subscribe to Pub/Sub and forward messages
        # ----------------------------------------------------------------
        pubsub = redis.pubsub()
        await pubsub.subscribe(channel_name)

        async def _receive_forever() -> None:
            """Listen for client disconnect signal."""
            try:
                while True:
                    await websocket.receive_text()
            except WebSocketDisconnect:
                pass

        receive_task = asyncio.create_task(_receive_forever())

        try:
            async for message in pubsub.listen():
                if receive_task.done():
                    break
                if message["type"] == "message":
                    data: str = message["data"]
                    await websocket.send_text(data)

                    # Check if execution is terminal
                    try:
                        parsed = json.loads(data)
                        if parsed.get("type") in (
                            "execution_completed",
                            "execution_failed",
                        ):
                            break
                    except json.JSONDecodeError:
                        pass
        finally:
            receive_task.cancel()
            await pubsub.unsubscribe(channel_name)
            await pubsub.aclose()

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.exception("ws.execution.error", execution_id=execution_id, error=str(e))
    finally:
        logger.info("ws.execution.disconnected", execution_id=execution_id)
        try:
            await websocket.close()
        except Exception:
            pass
