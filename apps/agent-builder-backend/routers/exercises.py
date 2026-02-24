import logging
import os
from uuid import uuid4
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel as PydanticBaseModel
from typing import List

from infra.temporal_client import TemporalClientManager
from exercise_workflows import ExerciseWorkflow
from state_store import ExerciseConfig, get_state_store

router = APIRouter(prefix="/api/exercises", tags=["exercises"])
logger = logging.getLogger(__name__)

class StartExerciseRequest(PydanticBaseModel):
    exercise_id: str = ""
    blueprint_id: str = ""
    config: ExerciseConfig = ExerciseConfig()

class ExerciseSignalRequest(PydanticBaseModel):
    signal: str
    payload: dict = {}

@router.get("", response_model=List[dict])
async def list_exercises():
    """List all known exercises from the Redis state store."""
    store = await get_state_store()
    try:
        if hasattr(store, "list_all"):
            states = await store.list_all()
        else:
            import redis.asyncio as aioredis
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
            r = aioredis.from_url(redis_url, decode_responses=True)
            keys = [k async for k in r.scan_iter("exercise:*")]
            await r.aclose()
            states = []
            for key in keys:
                ex_id = key.split(":", 1)[1]
                state = await store.get(ex_id)
                if state:
                    states.append(state)

        return [
            {
                "exercise_id": s.exercise_id,
                "status": "running" if s.is_running else "completed",
                "elapsed_minutes": round(s.elapsed_minutes, 1),
                "active_events": len(s.active_events),
                "units_engaged": sum(1 for u in s.unit_statuses if u.status == "engaged"),
                "total_units": len(s.unit_statuses),
                "decisions_count": getattr(s, "decisions_count", 0),
                "fatigue_violations": getattr(s, "fatigue_violations", 0),
            }
            for s in states
        ]
    except Exception as e:
        logger.warning(f"Could not list exercises: {e}")
        return []

@router.post("/start")
async def start_exercise(request: StartExerciseRequest):
    exercise_id = request.exercise_id or f"ex_{uuid4().hex[:8]}"
    blueprint_data: dict = {}
    if request.blueprint_id:
        try:
            from database import get_session
            from uuid import UUID
            from crud import CRUDBlueprint
            async for session in get_session():
                bp = await CRUDBlueprint.get(session, UUID(request.blueprint_id))
                if bp:
                    blueprint_data = bp.blueprint_data
        except Exception:
            pass

    client = await TemporalClientManager.get_client()
    wf_id = f"exercise-{exercise_id}"
    await client.start_workflow(
        ExerciseWorkflow.run,
        args=[exercise_id, request.config.model_dump(), blueprint_data],
        id=wf_id,
        task_queue="agent-execution-queue",
    )
    return {"exercise_id": exercise_id, "workflow_id": wf_id, "status": "started"}

@router.get("/{exercise_id}/status")
async def get_exercise_status(exercise_id: str):
    client = await TemporalClientManager.get_client()
    try:
        handle = client.get_workflow_handle(f"exercise-{exercise_id}")
        return await handle.query(ExerciseWorkflow.exercise_status)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{exercise_id}/signal")
async def signal_exercise(exercise_id: str, request: ExerciseSignalRequest):
    client = await TemporalClientManager.get_client()
    valid = {"inject_event", "pause", "resume", "stop", "override_unit"}
    if request.signal not in valid:
        raise HTTPException(status_code=400, detail=f"Unknown signal. Valid: {valid}")
    try:
        handle = client.get_workflow_handle(f"exercise-{exercise_id}")
        sig_map = {
            "pause": ExerciseWorkflow.pause,
            "resume": ExerciseWorkflow.resume,
            "stop": ExerciseWorkflow.stop,
            "inject_event": ExerciseWorkflow.inject_event,
            "override_unit": ExerciseWorkflow.override_unit,
        }
        sig = sig_map[request.signal]
        if request.payload:
            await handle.signal(sig, request.payload)
        else:
            await handle.signal(sig)
        return {"exercise_id": exercise_id, "signal": request.signal, "status": "sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{exercise_id}/state")
async def get_exercise_state(exercise_id: str):
    store = await get_state_store()
    state = await store.get(exercise_id)
    if not state:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return state.model_dump(mode="json")

@router.post("/{exercise_id}/stop")
async def stop_exercise(exercise_id: str):
    client = await TemporalClientManager.get_client()
    try:
        handle = client.get_workflow_handle(f"exercise-{exercise_id}")
        await handle.signal(ExerciseWorkflow.stop)
        return {"exercise_id": exercise_id, "status": "stopping"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{exercise_id}/map")
async def get_exercise_map(exercise_id: str):
    store = await get_state_store()
    state = await store.get(exercise_id)
    if not state:
        raise HTTPException(status_code=404, detail="Exercise not found")
    features = []
    for unit in state.unit_statuses:
        lat, lng = unit.location
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": {
                "id": unit.unit_id, "name": unit.name, "role": unit.role,
                "status": unit.status, "fatigue": round(unit.fatigue, 2),
                "marker_type": "unit",
                "color": "#6366f1" if unit.status == "available" else "#ef4444" if unit.status == "engaged" else "#f59e0b",
            }
        })
    for event in state.active_events:
        lat, lng = event.location
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": {
                "id": event.event_id, "type": event.event_type,
                "description": event.description, "priority": event.priority,
                "marker_type": "event",
                "color": "#ef4444" if event.priority >= 4 else "#f59e0b",
            }
        })
    return {
        "type": "FeatureCollection", "features": features,
        "metadata": {"exercise_id": exercise_id, "elapsed_minutes": state.elapsed_minutes, "is_running": state.is_running},
    }

@router.get("/{exercise_id}/messages")
async def get_exercise_messages(exercise_id: str, count: int = 20):
    from state_store import AgentMessage
    import redis.asyncio as aioredis
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    r = aioredis.from_url(redis_url, decode_responses=True)
    raw = await r.lrange(f"messages:{exercise_id}", 0, count - 1)
    await r.aclose()
    return [AgentMessage.model_validate_json(m) for m in raw]
