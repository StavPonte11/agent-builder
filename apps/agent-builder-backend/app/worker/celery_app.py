"""
Celery App Configuration
"""
from celery import Celery
import os

redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/1")

celery_app = Celery(
    "agent_builder_tasks",
    broker=redis_url,
    backend=redis_url,
    include=["app.worker.tasks"]
)

# Optional configuration, see the application user guide.
celery_app.conf.update(
    result_expires=3600,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
