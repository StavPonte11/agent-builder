"""
Sliding Window Rate Limiter Middleware backed by Redis.
"""
import time
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.redis import get_redis_client

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 100, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def dispatch(self, request: Request, call_next):
        # We only rate limit API routes
        if not request.url.path.startswith("/api/v1/"):
            return await call_next(request)
            
        # Get client IP or User ID
        client_id = request.client.host if request.client else "unknown"
        # In a real app, prefer extracting org_id or user_id from the JWT token
        auth_header = request.headers.get("Authorization")
        if auth_header:
            client_id = auth_header.split(" ")[-1][:20]  # rough slice for unique grouping
            
        redis = await get_redis_client()
        key = f"rate_limit:{client_id}"
        
        now = time.time()
        pipeline = redis.pipeline()
        
        # Remove old requests
        pipeline.zremrangebyscore(key, 0, now - self.window_seconds)
        # Add current request
        pipeline.zadd(key, {str(now): now})
        # Count requests in window
        pipeline.zcard(key)
        # Set expire so keys don't accumulate
        pipeline.expire(key, self.window_seconds)
        
        results = await pipeline.execute()
        request_count = results[2]
        
        await redis.aclose()
        
        if request_count > self.max_requests:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."}
            )
            
        return await call_next(request)
