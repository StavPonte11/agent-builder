"""
Redis async client singleton.
"""
from __future__ import annotations

import redis.asyncio as aioredis

from app.config import settings

_redis_client: aioredis.Redis | None = None  # type: ignore[type-arg]


async def get_redis_client() -> aioredis.Redis:  # type: ignore[type-arg]
    """Return the global Redis async client, creating it on first call."""
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30,
        )
    return _redis_client


async def close_redis_client() -> None:
    """Close the Redis client on application shutdown."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
