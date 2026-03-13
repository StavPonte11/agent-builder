"""
Scheduler Service

Manages the lifecycle of Scheduled Triggers (Cron Workflows) in Temporal.
When a Trigger of type SCHEDULE is created or updated, we register a Cron Workflow in Temporal.
When deactivated or deleted, we terminate that workflow.
"""
import logging
import uuid
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from temporalio.client import Client
from temporalio.exceptions import WorkflowExecutionError

from app.config import settings
from app.models.trigger import Trigger, TriggerType
from app.models.execution import Execution, ExecutionMode, ExecutionStatus

logger = logging.getLogger(__name__)

class SchedulerService:
    def __init__(self, db: AsyncSession):
        self.db = db
        # Client connection is heavy, recommend passing it or fetching on demand
    
    async def _get_client(self) -> Client:
        return await Client.connect(settings.TEMPORAL_HOST, namespace=settings.TEMPORAL_NAMESPACE)

    async def register_schedule(self, trigger: Trigger) -> str:
        """
        Starts a Temporal Workflow with a cron_schedule.
        Returns the Temporal Workflow ID used for this schedule.
        """
        if trigger.trigger_type != TriggerType.SCHEDULE:
            raise ValueError("Trigger is not of type SCHEDULE")
            
        cron_expr = trigger.config.get("cron", "0 0 * * *")  # default daily
        
        temporal_client = await self._get_client()
        workflow_id = f"sched-{trigger.id}"
        
        # We start a wrapper workflow or directly the execution workflow.
        # It's cleaner to let the blueprint workflow be the cron workflow.
        # However, we need to create an Execution object per run. 
        # For simplicity in this architecture, Temporal cron executes the workflow repeatedly.
        # Our workflow code (ExecuteBlueprintWorkflow) should check if it's a cron run
        # and create its own Execution record at the start.
        
        input_data = {
            "source": "schedule",
            "trigger_id": str(trigger.id)
        }
        
        # Start or update the cron workflow
        try:
            # First try to terminate if it exists
            handle = temporal_client.get_workflow_handle(workflow_id)
            await handle.terminate(reason="Restarting schedule")
        except Exception:
            pass # Doesn't exist yet
            
        await temporal_client.start_workflow(
            "ExecuteBlueprintWorkflow",
            args=[str(trigger.blueprint_id), input_data], # Note: passing blueprint_id instead of execution_id for crons
            id=workflow_id,
            task_queue=settings.TEMPORAL_TASK_QUEUE_EXECUTION,
            cron_schedule=cron_expr,
        )
        
        return workflow_id

    async def unregister_schedule(self, trigger: Trigger) -> None:
        """
        Terminates the scheduled workflow in Temporal.
        """
        if not trigger.temporal_schedule_id:
            return
            
        temporal_client = await self._get_client()
        try:
            handle = temporal_client.get_workflow_handle(trigger.temporal_schedule_id)
            await handle.terminate(reason="Trigger deactivated")
        except Exception as e:
            logger.warning(f"Failed to terminate schedule {trigger.temporal_schedule_id}: {e}")
