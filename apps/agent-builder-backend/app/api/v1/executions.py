"""
Executions API Router

Handles listing executions, retrieving exact status, and providing human-in-the-loop approvals.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import uuid
# from app.services.execution_service import ExecutionService   # stub for future db service

router = APIRouter(prefix="/executions", tags=["Executions"])

class ApprovalRequest(BaseModel):
    node_id: str
    approved: bool
    feedback: str = ""

@router.get("/")
async def list_executions(blueprint_id: uuid.UUID | None = None, limit: int = 50, skip: int = 0):
    """List executions, optionally filtered by blueprint_id."""
    # STUB: Returns static list
    return [
        {
            "id": uuid.uuid4(),
            "blueprint_id": blueprint_id or uuid.uuid4(),
            "status": "completed",
            "total_tokens": 1500,
            "total_cost_usd": 0.015,
            "started_at": "2026-03-08T10:00:00Z"
        }
    ]

@router.get("/{execution_id}")
async def get_execution(execution_id: uuid.UUID):
    """Get the full status and node-level details of a single execution."""
    # STUB: Return static details
    return {
        "id": execution_id,
        "status": "running",
        "node_states": {
            "node-1": {"status": "completed", "output": {"result": "ok"}},
            "node-2": {"status": "blocked", "error": None}
        }
    }

@router.post("/{execution_id}/approve", status_code=status.HTTP_202_ACCEPTED)
async def approve_execution_node(execution_id: uuid.UUID, approval: ApprovalRequest):
    """
    Submits a human-in-the-loop approval decision.
    This routes the decision to the running Temporal workflow via Signals.
    """
    # STUB: In reality we would call `temporal_client.get_workflow_handle(...).signal("approve_signal", args)`
    import logging
    logger = logging.getLogger(__name__)
    decision = "APPROVED" if approval.approved else "REJECTED"
    logger.info(f"Execution {execution_id} Node {approval.node_id} was {decision} by user. Feedback: {approval.feedback}")
    
    return {"status": "signal_sent", "node_id": approval.node_id, "decision": decision}
