"""
Prometheus metrics endpoint.
Expose at GET /metrics for scraping.
"""
from __future__ import annotations

from fastapi import APIRouter, Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

metrics_router = APIRouter(tags=["Metrics"])

# ---------------------------------------------------------------------------
# Counters
# ---------------------------------------------------------------------------
EXECUTIONS_TOTAL = Counter(
    "agent_builder_executions_total",
    "Total blueprint executions",
    labelnames=["blueprint_id", "status", "mode"],
)

LLM_TOKENS_TOTAL = Counter(
    "agent_builder_llm_tokens_total",
    "Total LLM tokens consumed",
    labelnames=["provider", "model", "token_type"],
)

GUARDRAIL_TRIGGERS_TOTAL = Counter(
    "agent_builder_guardrail_triggers_total",
    "Total guardrail check triggers",
    labelnames=["check_type", "action"],
)

API_REQUESTS_TOTAL = Counter(
    "agent_builder_api_requests_total",
    "Total API requests",
    labelnames=["method", "endpoint", "status_code"],
)

# ---------------------------------------------------------------------------
# Histograms
# ---------------------------------------------------------------------------
EXECUTION_DURATION = Histogram(
    "agent_builder_execution_duration_seconds",
    "Blueprint execution duration",
    labelnames=["blueprint_id", "mode"],
    buckets=(1, 5, 10, 30, 60, 120, 300, 600),
)

NODE_DURATION = Histogram(
    "agent_builder_node_duration_seconds",
    "Individual node execution duration",
    labelnames=["node_type", "provider"],
    buckets=(0.1, 0.5, 1, 2, 5, 10, 30),
)

API_REQUEST_DURATION = Histogram(
    "agent_builder_api_request_duration_seconds",
    "API request duration",
    labelnames=["method", "endpoint"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5),
)

# ---------------------------------------------------------------------------
# Gauges
# ---------------------------------------------------------------------------
ACTIVE_EXECUTIONS = Gauge(
    "agent_builder_active_executions",
    "Currently active executions",
    labelnames=["mode"],
)

PENDING_APPROVALS = Gauge(
    "agent_builder_pending_approvals",
    "Number of pending human-in-the-loop approvals",
)

TEMPORAL_QUEUE_DEPTH = Gauge(
    "agent_builder_temporal_queue_depth",
    "Temporal task queue depth",
    labelnames=["task_queue"],
)


@metrics_router.get("/metrics")
async def prometheus_metrics() -> Response:
    """Exposition of Prometheus metrics for scraping."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )
