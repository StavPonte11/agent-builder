"""
Approvals API Router

Handles listing human-in-the-loop approvals across all executions.
Used by the Admin Review Panel.
"""
from fastapi import APIRouter
import uuid
import datetime

router = APIRouter(prefix="/approvals", tags=["Approvals"])

@router.get("/")
async def list_approvals():
    """List pending and historical human-in-the-loop approvals."""
    # STUB: In reality, we'd query the DB for ExecutionActivity rows waiting for approval
    # For now, return a static list of demo approvals to populate the UI.
    now = datetime.datetime.now(datetime.timezone.utc)
    
    return [
        {
            "execution_id": f"exec-{uuid.uuid4()}",
            "blueprint_id": str(uuid.uuid4()),
            "blueprint_name": "Customer Onboarding Tracker",
            "node_id": "review_email_draft",
            "status": "pending",
            "requested_at": (now - datetime.timedelta(minutes=15)).isoformat(),
            "resolved_at": None,
            "prompt_text": "Please review this email draft before we send it to the new customer.",
            "context": {
                "user_id": "user_123",
                "email_subject": "Welcome to Agent Builder!",
                "email_body": "Hi there,\n\nThanks for signing up. Here are your next steps...",
                "confidence_score": 0.82
            }
        },
        {
            "execution_id": f"exec-{uuid.uuid4()}",
            "blueprint_id": str(uuid.uuid4()),
            "blueprint_name": "Financial Report Generator",
            "node_id": "manager_signoff",
            "status": "pending",
            "requested_at": (now - datetime.timedelta(hours=2)).isoformat(),
            "resolved_at": None,
            "prompt_text": "Sign off on the Q3 preliminary numbers?",
            "context": {
                "report_q3_revenue": "$2.4M",
                "report_q3_expenses": "$1.8M",
                "notes": "Pending final tax audit."
            }
        },
        {
            "execution_id": f"exec-{uuid.uuid4()}",
            "blueprint_id": str(uuid.uuid4()),
            "blueprint_name": "Refund Processor",
            "node_id": "approve_refund",
            "status": "approved",
            "requested_at": (now - datetime.timedelta(days=1, hours=2)).isoformat(),
            "resolved_at": (now - datetime.timedelta(days=1)).isoformat(),
            "prompt_text": "Approve refund of $45.00 for order #9928?",
            "context": {
                "order_id": "9928",
                "amount": 45.00,
                "reason": "Item arrived damaged"
            }
        },
        {
            "execution_id": f"exec-{uuid.uuid4()}",
            "blueprint_id": str(uuid.uuid4()),
            "blueprint_name": "Social Media Auto-Poster",
            "node_id": "review_tweet",
            "status": "rejected",
            "requested_at": (now - datetime.timedelta(days=2)).isoformat(),
            "resolved_at": (now - datetime.timedelta(days=2, minutes=-30)).isoformat(),
            "prompt_text": "Review generated tweet for the new feature launch.",
            "context": {
                "tweet_text": "Our new feature is lit ngl 🔥🚀 #tech",
                "tone": "professional"
            }
        }
    ]
