"""
Webhooks API Router

Handles public-facing, unauthenticated triggers from external systems (GitHub, Slack, etc).
"""
import uuid
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_db
from app.models.trigger import Trigger, TriggerType
from app.models.execution import Execution, ExecutionMode, ExecutionStatus

from temporalio.client import Client
from app.config import settings

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])
logger = logging.getLogger(__name__)

async def get_temporal_client() -> Client:
    return await Client.connect(settings.TEMPORAL_HOST, namespace=settings.TEMPORAL_NAMESPACE)


@router.post("/{trigger_id}", status_code=status.HTTP_202_ACCEPTED)
async def trigger_webhook(
    trigger_id: uuid.UUID,
    request: Request,
    authorization: str | None = Header(default=None),
    x_webhook_secret: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Public webhook endpoint. Validates the trigger ID and optional secret,
    then dispatches an execution of the associated Blueprint.
    """
    # 1. Fetch Trigger
    stmt = select(Trigger).where(
        Trigger.id == trigger_id,
        Trigger.trigger_type == TriggerType.WEBHOOK,
        Trigger.is_active == True,
    )
    result = await db.execute(stmt)
    trigger = result.scalar_one_or_none()

    if not trigger:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Webhook trigger not found or inactive."
        )

    # 2. Validate Secret (if configured)
    expected_secret = trigger.config.get("secret")
    if expected_secret:
        # Check Authorization header (Bearer token) or custom X-Webhook-Secret header
        provided_secret = x_webhook_secret
        if authorization and authorization.startswith("Bearer "):
            provided_secret = authorization.replace("Bearer ", "")
            
        import hmac
        if provided_secret is None or not hmac.compare_digest(provided_secret, expected_secret):
            logger.warning(f"Unauthorized webhook attempt for trigger {trigger_id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook secret."
            )

    # 3. Parse Payload
    try:
        body = await request.json()
    except Exception:
        body = {}

    # Gather query params and headers for context
    query_params = dict(request.query_params)
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ["authorization", "x-webhook-secret"]}

    input_data = {
        "body": body,
        "query": query_params,
        "headers": headers
    }

    # 4. Create Execution intent in DB
    execution = Execution(
        blueprint_id=trigger.blueprint_id,
        blueprint_version=0,  # Or logic to resolve latest published version
        org_id=trigger.org_id,
        triggered_by=trigger.created_by, # Attributes run to the trigger creator
        execution_mode=ExecutionMode.PRODUCTION,
        status=ExecutionStatus.PENDING,
        input_data=input_data,
        is_sandbox=False,
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)

    # 5. Dispatch to Temporal
    try:
        temporal_client = await get_temporal_client()
        workflow_id = f"exec-{execution.id}"
        
        # We start the workflow asynchronously. The workflow handles execution.
        await temporal_client.start_workflow(
            "ExecuteBlueprintWorkflow",
            args=[str(execution.id), input_data],
            id=workflow_id,
            task_queue=settings.TEMPORAL_TASK_QUEUE_EXECUTION,
        )
        
        execution.temporal_workflow_id = workflow_id
        db.add(execution)
        await db.commit()
        
    except Exception as e:
        logger.error(f"Failed to start Temporal workflow for execution {execution.id}: {e}")
        execution.status = ExecutionStatus.FAILED
        execution.error_details = {"error": "Temporal dispatch failed", "details": str(e)}
        db.add(execution)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to dispatch execution."
        )

    return {
        "status": "accepted",
        "execution_id": execution.id,
        "blueprint_id": trigger.blueprint_id
    }
