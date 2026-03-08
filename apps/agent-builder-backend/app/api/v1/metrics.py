"""
Prometheus Metrics Endpoint.

Exposes API request counts, latency, and system metrics.
"""
import time
from fastapi import APIRouter, Request
from starlette.middleware.base import BaseHTTPMiddleware
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response

router = APIRouter()

# Metrics definition
REQUEST_COUNT = Counter("api_requests_total", "Total API Requests", ["method", "endpoint"])
REQUEST_LATENCY = Histogram("api_request_latency_seconds", "API Request Latency", ["method", "endpoint"])

class PrometheusMiddleware(BaseHTTPMiddleware):
    """Middleware to automatically track metrics for all requests."""
    async def dispatch(self, request: Request, call_next):
        method = request.method
        # Simplify path to avoid cardinality explosion (e.g., replace UUIDs)
        path = request.url.path
        if "/api/v1/" in path:
            # simple regex or split can normalize IDs. We'll track raw path for now.
            pass
            
        start_time = time.time()
        response = await call_next(request)
        latency = time.time() - start_time
        
        REQUEST_COUNT.labels(method=method, endpoint=path).inc()
        REQUEST_LATENCY.labels(method=method, endpoint=path).observe(latency)
        
        return response

@router.get("/metrics", include_in_schema=False)
async def metrics():
    """Endpoint for Prometheus to scrape."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
