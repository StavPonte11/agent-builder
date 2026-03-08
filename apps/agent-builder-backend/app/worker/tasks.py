"""
Celery Background Tasks
"""
import time
import httpx
import logging
from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, max_retries=3)
def send_webhook(self, url: str, payload: dict):
    """
    Sends an HTTP POST webhook. Used to notify external systems 
    when a blueprint execution finishes or requires human approval.
    """
    try:
        response = httpx.post(url, json=payload, timeout=5.0)
        response.raise_for_status()
        logger.info(f"Webhook sent to {url} successfully")
    except httpx.HTTPError as exc:
        logger.error(f"Failed to send webhook to {url}: {exc}")
        self.retry(exc=exc, countdown=2 ** self.request.retries)

@celery_app.task
def generate_weekly_report(org_id: str):
    """
    Scheduled task to generate a weekly token usage and execution report for an organization.
    """
    # Logic to aggregate metrics from database and email the organization admins
    logger.info(f"Generating weekly report for {org_id}")
    time.sleep(2)
    logger.info(f"Weekly report generated for {org_id}")
