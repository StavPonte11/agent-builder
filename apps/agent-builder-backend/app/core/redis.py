"""
Redis configuration for Pub/Sub and Rate Limiting.
"""
import logging
from typing import AsyncGenerator
import redis.asyncio as redis

logger = logging.getLogger(__name__)

REDIS_URL = "redis://localhost:6379/0"

async def get_redis_client() -> redis.Redis:
    """Returns a connected async Redis client."""
    client = redis.from_url(REDIS_URL, decode_responses=True)
    return client

async def publish_execution_event(execution_id: str, event_data: dict):
    """Publishes a live execution event to a Redis channel for WebSockets to consume."""
    client = await get_redis_client()
    import json
    channel = f"execution:{execution_id}"
    await client.publish(channel, json.dumps(event_data))
    await client.aclose()

async def subscribe_execution_events(execution_id: str) -> AsyncGenerator[dict, None]:
    """Subscribes to a Redis channel and yields events (for WebSocket streaming)."""
    client = await get_redis_client()
    pubsub = client.pubsub()
    channel = f"execution:{execution_id}"
    await pubsub.subscribe(channel)
    
    import json
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                yield json.loads(message["data"])
    finally:
        await pubsub.unsubscribe(channel)
        await client.aclose()
