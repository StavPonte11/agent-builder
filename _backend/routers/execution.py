from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession

from database import get_session
from db_models import ExecutionSession
from crud import CRUDBlueprint, CRUDExecution
from api_schemas import ExecutionCreateRequest, ExecutionStatusResponse
from infra.temporal_client import TemporalClientManager
from temporal_workflows import AgentExecutionWorkflow

router = APIRouter(prefix="/api", tags=["execution"])

@router.post("/execute", response_model=ExecutionStatusResponse)
async def execute_agent(
    request: ExecutionCreateRequest,
    session: AsyncSession = Depends(get_session)
):
    user_id = "user_default" # Mock Auth
    blueprint = await CRUDBlueprint.get(session, request.blueprint_id)
    if not blueprint:
        raise HTTPException(status_code=404, detail="Blueprint not found")

    client = await TemporalClientManager.get_client()
    workflow_id = f"agent-exec-{request.blueprint_id}-{uuid4()}"
    await client.start_workflow(
        AgentExecutionWorkflow.run,
        args=[str(request.blueprint_id), request.input_data, user_id, workflow_id],
        id=workflow_id,
        task_queue="agent-execution-queue",
    )
    
    execution = ExecutionSession(
        blueprint_id=request.blueprint_id,
        user_id=user_id,
        workflow_id=workflow_id,
        status="running",
        input_data=request.input_data
    )
    saved_execution = await CRUDExecution.create(session, execution)
    
    return ExecutionStatusResponse(
        execution_id=saved_execution.id,
        workflow_id=saved_execution.workflow_id,
        status=saved_execution.status,
        created_at=saved_execution.created_at.isoformat()
    )

@router.get("/execute/{execution_id}/status", response_model=ExecutionStatusResponse)
async def get_execution_status(
    execution_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    execution = await CRUDExecution.get(session, execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")

    return ExecutionStatusResponse(
        execution_id=execution.id,
        workflow_id=execution.workflow_id,
        status=execution.status,
        result=execution.result_data,
        created_at=execution.created_at.isoformat(),
        completed_at=execution.completed_at.isoformat() if execution.completed_at else None
    )
