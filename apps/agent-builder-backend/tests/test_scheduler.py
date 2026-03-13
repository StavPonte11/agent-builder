import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock
from app.models.trigger import Trigger, TriggerType
from app.services.scheduler_service import SchedulerService

pytestmark = pytest.mark.asyncio


async def test_scheduler_register_schedule(db_session, test_user, test_organization, monkeypatch):
    """Test that a trigger of type SCHEDULE is registered with Temporal correctly."""
    
    # 1. Setup Trigger
    trigger = Trigger(
        id=uuid.uuid4(),
        org_id=test_organization.id,
        blueprint_id=uuid.uuid4(),
        created_by=test_user.id,
        name="Daily Trigger",
        trigger_type=TriggerType.SCHEDULE,
        config={"cron": "0 8 * * *"}, # Every day at 8 AM
        is_active=True
    )
    db_session.add(trigger)
    await db_session.commit()
    
    # 2. Mock Temporal Client
    mock_client = AsyncMock()
    mock_handle = AsyncMock()
    mock_client.get_workflow_handle.return_value = mock_handle
    
    svc = SchedulerService(db_session)
    monkeypatch.setattr(svc, "_get_client", AsyncMock(return_value=mock_client))
    
    # 3. Call Registration
    workflow_id = await svc.register_schedule(trigger)
    
    # 4. Assertions
    assert workflow_id == f"sched-{trigger.id}"
    
    # It should have checked for existing schedules
    mock_client.get_workflow_handle.assert_called_with(workflow_id)
    mock_handle.terminate.assert_called_with(reason="Restarting schedule")
    
    # It should start the cron workflow
    mock_client.start_workflow.assert_called_once()
    kwargs = mock_client.start_workflow.call_args.kwargs
    assert kwargs["id"] == workflow_id
    assert kwargs["cron_schedule"] == "0 8 * * *"
    assert kwargs["args"][1]["source"] == "schedule"


async def test_scheduler_register_invalid_type(db_session):
    """Test that registering a non-schedule trigger throws an Error."""
    trigger = Trigger(
        id=uuid.uuid4(),
        org_id=uuid.uuid4(),
        blueprint_id=uuid.uuid4(),
        created_by=uuid.uuid4(),
        name="Webhook Trigger",
        trigger_type=TriggerType.WEBHOOK, # Invalid type for scheduler
        config={"secret": "abc"}
    )
    
    svc = SchedulerService(db_session)
    
    with pytest.raises(ValueError, match="Trigger is not of type SCHEDULE"):
        await svc.register_schedule(trigger)


async def test_scheduler_unregister_schedule(db_session, monkeypatch):
    """Test unregistering a trigger kills the Temporal Cron."""
    trigger = Trigger(
        id=uuid.uuid4(),
        org_id=uuid.uuid4(),
        blueprint_id=uuid.uuid4(),
        created_by=uuid.uuid4(),
        name="Cron",
        trigger_type=TriggerType.SCHEDULE,
        is_active=False,
        temporal_schedule_id="sched-12345"
    )
    
    # Mock Temporal
    mock_client = AsyncMock()
    mock_handle = AsyncMock()
    mock_client.get_workflow_handle.return_value = mock_handle
    
    svc = SchedulerService(db_session)
    monkeypatch.setattr(svc, "_get_client", AsyncMock(return_value=mock_client))
    
    await svc.unregister_schedule(trigger)
    
    mock_client.get_workflow_handle.assert_called_with("sched-12345")
    mock_handle.terminate.assert_called_with(reason="Trigger deactivated")
