import pytest
import uuid
from fastapi.testclient import TestClient
from sqlmodel import Session, select
from httpx import AsyncClient

from app.main import app
from app.models.trigger import Trigger, TriggerType
from app.models.execution import Execution, ExecutionStatus
from app.models.blueprint import Blueprint, BlueprintType

# Use test database fixtures when setting up the database
pytestmark = pytest.mark.asyncio

async def test_trigger_webhook_success(db_session, test_user, test_organization):
    """Test a successful webhook hit creating an execution and starting temporal workflow."""
    
    # 1. Setup Blueprint & Trigger
    blueprint = Blueprint(
        id=uuid.uuid4(),
        org_id=test_organization.id,
        created_by=test_user.id,
        name="Test Webhook BP",
        blueprint_type=BlueprintType.WORKFLOW
    )
    db_session.add(blueprint)
    
    trigger = Trigger(
        id=uuid.uuid4(),
        org_id=test_organization.id,
        blueprint_id=blueprint.id,
        created_by=test_user.id,
        name="Test Webhook",
        trigger_type=TriggerType.WEBHOOK,
        config={"secret": "my-super-secret"},
        is_active=True
    )
    db_session.add(trigger)
    await db_session.commit()

    # 2. Hit the webhook endpoint
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            f"/api/v1/webhooks/{trigger.id}",
            headers={"X-Webhook-Secret": "my-super-secret"},
            json={"event": "github_push", "repo": "test/repo"}
        )
        
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "accepted"
    assert "execution_id" in data
    
    # 3. Verify Execution was created
    stmt = select(Execution).where(Execution.id == uuid.UUID(data["execution_id"]))
    exec_result = await db_session.execute(stmt)
    execution = exec_result.scalar_one()
    
    assert execution.blueprint_id == blueprint.id
    assert execution.input_data["body"]["event"] == "github_push"


async def test_trigger_webhook_invalid_secret(db_session, test_user, test_organization):
    """Test webhook with wrong secret returns 401."""
    
    trigger = Trigger(
        id=uuid.uuid4(),
        org_id=test_organization.id,
        blueprint_id=uuid.uuid4(),
        created_by=test_user.id,
        name="Test Webhook Failed",
        trigger_type=TriggerType.WEBHOOK,
        config={"secret": "correct-secret"},
        is_active=True
    )
    db_session.add(trigger)
    await db_session.commit()
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            f"/api/v1/webhooks/{trigger.id}",
            headers={"X-Webhook-Secret": "wrong-secret"},
            json={}
        )
        
    assert response.status_code == 401
    assert "Invalid webhook secret" in response.json()["detail"]


async def test_trigger_webhook_not_found(db_session):
    """Test webhook hitting a deleted/non-existent trigger returns 404."""
    random_id = uuid.uuid4()
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(f"/api/v1/webhooks/{random_id}", json={})
        
    assert response.status_code == 404
