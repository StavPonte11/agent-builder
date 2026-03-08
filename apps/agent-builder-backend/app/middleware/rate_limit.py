"""
Redis sliding-window rate limiter middleware.

Strategy:
- Per-user limit AND per-org limit, whichever triggers first returns 429.
- Window: 1 hour sliding, checked in 1-second buckets.
- Plan-tier aware: limits stored in config.
- Returns Retry-After header indicating seconds until window resets.
"""
from __future__ import annotations

import math
import time
from typing import Any

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings

# Limits per plan tier (executions/hr, api_calls/hr)
RATE_LIMITS: dict[str, dict[str, int]] = {
    "free":       {"executions": 100,   "api_calls": 1_000},
    "pro":        {"executions": 1_000,  "api_calls": 10_000},
    "enterprise": {"executions": 10_000, "api_calls": 100_000},
}

# Paths to skip rate limiting (health, openapi, metrics)
SKIP_PATHS = {"/health", "/openapi.json", "/docs", "/redoc", "/metrics"}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Redis sliding window rate limiter."""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        if request.url.path in SKIP_PATHS:
            return await call_next(request)

        # Only limit authenticated endpoints — extract user/org from request state
        # State is set by auth middleware if present; skip otherwise
        user_id: str | None = getattr(request.state, "user_id", None)
        org_id: str | None = getattr(request.state, "org_id", None)
        plan_tier: str = getattr(request.state, "plan_tier", "free")

        if user_id is None:
            return await call_next(request)

        from app.redis_client import get_redis_client
        redis = await get_redis_client()

        now = time.time()
        window_start = math.floor(now)
        limits = RATE_LIMITS.get(plan_tier, RATE_LIMITS["free"])
        max_calls = limits["api_calls"]

        # Sliding window key per user
        user_key = f"rl:{org_id}:{user_id}:api_calls:{window_start}"
        org_key = f"rl:{org_id}:api_calls:{window_start}"

        pipe = redis.pipeline()
        pipe.incr(user_key)
        pipe.expire(user_key, 3660)  # expire after window + buffer
        pipe.incr(org_key)
        pipe.expire(org_key, 3660)
        results: list[int] = await pipe.execute()

        user_count, _, org_count, _ = results

        if user_count > max_calls or org_count > max_calls:
            retry_after = window_start + 3600 - now
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded",
                    "retry_after_seconds": int(retry_after),
                },
                headers={"Retry-After": str(int(retry_after))},
            )

        return await call_next(request)
