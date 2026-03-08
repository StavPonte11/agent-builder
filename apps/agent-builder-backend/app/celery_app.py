"""
Celery application factory.
4 queues: default, webhooks, cache, reports.
"""
from __future__ import annotations

from celery import Celery

from app.config import settings

celery_app = Celery(
    "agent_builder",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.webhooks",
        "app.tasks.cache",
        "app.tasks.reports",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,  # Fair dispatch
    task_routes={
        "app.tasks.webhooks.*": {"queue": "webhooks"},
        "app.tasks.cache.*": {"queue": "cache"},
        "app.tasks.reports.*": {"queue": "reports"},
    },
    task_default_queue="default",
    # Retry policy defaults
    task_max_retries=3,
    task_default_retry_delay=30,  # seconds
)
