from typing import Optional, List
from temporalio.client import ScheduleIntervalSpec, ScheduleSpec, ScheduleActionStartWorkflow, Schedule
from infra.temporal_client import TemporalClientManager
from temporal_workflows import AgentExecutionWorkflow
from uuid import uuid4

class ScheduleManager:
    @staticmethod
    async def create_schedule(
        schedule_id: str,
        blueprint_id: str,
        user_id: str,
        input_data: dict,
        interval_seconds: int,
        cron_expression: Optional[str] = None
    ):
        client = await TemporalClientManager.get_client()
        
        # Define the action: Start the AgentExecutionWorkflow
        workflow_id = f"scheduled-exec-{blueprint_id}-{uuid4()}"
        
        action = ScheduleActionStartWorkflow(
            AgentExecutionWorkflow.run,
            args=[blueprint_id, input_data, user_id, workflow_id],
            id=workflow_id,
            task_queue="agent-execution-queue",
        )
        
        # Define the spec: Interval or Cron
        spec = ScheduleSpec()
        if cron_expression:
            spec.cron_expressions = [cron_expression]
        else:
            spec.intervals = [ScheduleIntervalSpec(every=interval_seconds)]
            
        # Create the schedule
        await client.create_schedule(
            id=schedule_id,
            schedule=Schedule(action=action, spec=spec),
        )
        return schedule_id

    @staticmethod
    async def list_schedules() -> List[str]:
        client = await TemporalClientManager.get_client()
        # Note: Listing schedules in Temporal is async iterator
        schedules = []
        async for s in client.list_schedules():
            schedules.append(s.id)
        return schedules

    @staticmethod
    async def pause_schedule(schedule_id: str, pause_note: str = "Paused by user"):
        client = await TemporalClientManager.get_client()
        handle = client.get_schedule_handle(schedule_id)
        await handle.pause(note=pause_note)

    @staticmethod
    async def unpause_schedule(schedule_id: str, note: str = "Unpaused by user"):
        client = await TemporalClientManager.get_client()
        handle = client.get_schedule_handle(schedule_id)
        await handle.unpause(note=note)
    
    @staticmethod
    async def delete_schedule(schedule_id: str):
        client = await TemporalClientManager.get_client()
        handle = client.get_schedule_handle(schedule_id)
        await handle.delete()
