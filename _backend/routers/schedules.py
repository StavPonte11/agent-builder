from fastapi import APIRouter
from api_schemas import ScheduleCreateRequest, ScheduleResponse
from schedules import ScheduleManager

router = APIRouter(prefix="/api/schedules", tags=["schedules"])

@router.post("", response_model=ScheduleResponse)
async def create_schedule(request: ScheduleCreateRequest):
    user_id = "user_default"
    await ScheduleManager.create_schedule(
        schedule_id=request.schedule_id,
        blueprint_id=str(request.blueprint_id),
        user_id=user_id,
        input_data=request.input_data,
        interval_seconds=60,
        cron_expression=request.cron_expression
    )
    return ScheduleResponse(
        schedule_id=request.schedule_id,
        blueprint_id=request.blueprint_id,
        cron_expression=request.cron_expression
    )
    
@router.get("")
async def list_schedules():
    return await ScheduleManager.list_schedules()
