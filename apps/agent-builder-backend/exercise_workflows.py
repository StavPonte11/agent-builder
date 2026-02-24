"""
exercise_workflows.py — Temporal workflows for exercise orchestration (Phase 4)

Implements:
 - ExerciseWorkflow: Long-running Temporal workflow managing the full exercise lifecycle
   * Supports Signals: inject_event, pause, resume, override_unit, stop
   * Supports Queries: exercise_status
 - Activities: create_exercise, tick_simulation, run_scenario_generator, run_director
"""

import logging
from datetime import timedelta
from typing import Dict, Any

from temporalio import workflow, activity
from temporalio.common import RetryPolicy

logger = logging.getLogger(__name__)


# ── Activities ─────────────────────────────────────────────────────

@activity.defn
async def create_exercise_activity(exercise_id: str, config_data: Dict[str, Any]) -> Dict[str, Any]:
    """Initialize the ExerciseState in Redis from config."""
    from state_store import get_state_store, ExerciseConfig, build_initial_state
    config = ExerciseConfig(**config_data)
    store = await get_state_store()
    
    # Check if already exists (idempotent)
    existing = await store.get(exercise_id)
    if existing:
        return existing.model_dump(mode="json")
    
    state = build_initial_state(exercise_id, config)
    state = state.model_copy(update={"is_running": True})
    created = await store.create(state)
    logger.info(f"[create_exercise] Exercise {exercise_id} initialized with {len(created.unit_statuses)} units")
    return created.model_dump(mode="json")


@activity.defn
async def tick_simulation_activity(exercise_id: str, tick_minutes: int = 1) -> Dict[str, Any]:
    """Advance simulation clock by tick_minutes, update fatigue on all units."""
    from state_store import get_state_store
    store = await get_state_store()
    state = await store.advance_time(exercise_id, tick_minutes)
    return {
        "elapsed_minutes": state.elapsed_minutes,
        "unit_count": len(state.unit_statuses),
        "active_events": len(state.active_events),
    }


@activity.defn
async def run_scenario_generator_activity(exercise_id: str, config_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Scenario Generator — creates new events based on elapsed time and scenario type.
    Injects chaos events if inject_chaos is enabled.
    """
    from state_store import get_state_store, ExerciseEvent, ExerciseConfig
    import uuid, random
    
    store = await get_state_store()
    state = await store.get(exercise_id)
    config = ExerciseConfig(**config_data)
    
    if not state:
        return {"generated": 0}

    # Only generate events every 5 sim minutes
    if state.elapsed_minutes % 5 != 0:
        return {"generated": 0}

    event_templates = {
        "crowd_control": [
            ("crowd_disturbance", "Large crowd gathering near central square", 3),
            ("violence", "Reports of violence at protest site", 4),
            ("medical", "Medical emergency reported in crowd", 4),
        ],
        "port_incident": [
            ("suspicious_activity", "Suspicious vehicle near port gate 3", 3),
            ("hazmat", "Hazmat spill reported at dock 7", 5),
            ("intruder", "Unauthorized personnel detected at security perimeter", 4),
        ],
        "terror_attack": [
            ("threat_report", "Anonymous threat received for shopping center", 4),
            ("suspicious_package", "Unattended bag reported at bus station", 5),
            ("evacuation_required", "Building evacuation required — bomb threat", 5),
        ],
    }

    templates = event_templates.get(config.scenario_type, event_templates["crowd_control"])
    
    # Generate 1-2 events per tick
    n_events = random.randint(1, 2) if config.inject_chaos and random.random() < 0.4 else 1
    generated = 0
    
    for _ in range(n_events):
        template = random.choice(templates)
        event_type, description, base_priority = template
        
        # Randomize location around Tel Aviv
        lat = 31.77 + random.uniform(-0.05, 0.05)
        lng = 34.75 + random.uniform(-0.05, 0.05)
        
        event = ExerciseEvent(
            event_id=f"evt_{uuid.uuid4().hex[:8]}",
            event_type=event_type,
            description=f"T+{state.elapsed_minutes}min: {description}",
            location=(lat, lng),
            priority=base_priority,
        )
        await store.add_event(exercise_id, event)
        generated += 1
        logger.info(f"[scenario_gen] New event: {event.event_type} (priority {event.priority})")

    return {"generated": generated, "elapsed_minutes": state.elapsed_minutes}


@activity.defn
async def run_director_activity(exercise_id: str, blueprint_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Director Agent — runs the LangGraph blueprint on the current ExerciseState.
    The blueprint's nodes (state_reader → llm → state_writer) handle the actual
    dispatch decisions.
    """
    from graph_factory import GraphFactory
    from database import get_checkpointer
    from blueprint_schema import BlueprintSchema
    from state_store import get_state_store
    import uuid

    store = await get_state_store()
    state = await store.get(exercise_id)
    if not state:
        return {"error": f"Exercise {exercise_id} not found"}
    
    if not state.active_events:
        return {"skipped": True, "reason": "no active events"}

    checkpointer = await get_checkpointer()
    factory = GraphFactory()
    schema = BlueprintSchema(**blueprint_data)
    app = await factory.compile(schema, checkpointer)

    config = {"configurable": {"thread_id": f"{exercise_id}_director"}}
    
    input_data = {
        "messages": [],
        "exercise_id": exercise_id,
        "shared_context": {
            "active_events": len(state.active_events),
            "available_units": sum(1 for u in state.unit_statuses if u.status == "available"),
        }
    }
    
    result = await app.ainvoke(input_data, config)
    messages = result.get("messages", [])
    last = messages[-1].content if messages else "No output"
    
    logger.info(f"[director] Run complete for exercise {exercise_id}: {last[:100]}")
    return {"output": last, "messages_count": len(messages)}


@activity.defn
async def finalize_exercise_activity(exercise_id: str) -> Dict[str, Any]:
    """Mark the exercise as complete and persist final state."""
    from state_store import get_state_store
    
    store = await get_state_store()
    state = await store.get(exercise_id)
    if not state:
        return {"error": "Exercise not found"}
    
    final = state.model_copy(update={"is_running": False})
    await store.save(final)
    
    return {
        "exercise_id": exercise_id,
        "total_events": len(state.active_events) + len(state.resolved_events),
        "total_decisions": len(state.decisions_log),
        "elapsed_minutes": state.elapsed_minutes,
    }


# ── Exercise Workflow ───────────────────────────────────────────────

@workflow.defn
class ExerciseWorkflow:
    """
    Main exercise orchestration workflow.
    
    Lifecycle:
      1. Initialize ExerciseState in Redis
      2. Loop: tick simulation → generate events → run director
      3. Accept Signals: inject_event, pause, resume, stop, override_unit
      4. Query: exercise_status
      5. Finalize and return summary
    """

    def __init__(self):
        self._paused = False
        self._stopped = False
        self._injected_events: list[dict] = []
        self._override_units: list[dict] = []
        self._exercise_id: str = ""
        self._elapsed_minutes: int = 0
        self._active_events: int = 0

    # ── Signals ────────────────────────────────────────────────────

    @workflow.signal
    async def inject_event(self, event_data: dict) -> None:
        """Instructor injects a custom event mid-exercise."""
        self._injected_events.append(event_data)
        workflow.logger.info(f"[signal] inject_event: {event_data.get('event_type')}")

    @workflow.signal
    async def pause(self) -> None:
        workflow.logger.info("[signal] pause received")
        self._paused = True

    @workflow.signal
    async def resume(self) -> None:
        workflow.logger.info("[signal] resume received")
        self._paused = False

    @workflow.signal
    async def stop(self) -> None:
        workflow.logger.info("[signal] stop received — finalizing exercise")
        self._stopped = True

    @workflow.signal
    async def override_unit(self, override_data: dict) -> None:
        """Instructor manually overrides a unit status."""
        self._override_units.append(override_data)

    # ── Query ──────────────────────────────────────────────────────

    @workflow.query
    def exercise_status(self) -> dict:
        return {
            "exercise_id": self._exercise_id,
            "elapsed_minutes": self._elapsed_minutes,
            "is_running": not self._stopped,
            "is_paused": self._paused,
            "active_events": self._active_events,
        }

    # ── Main Run ───────────────────────────────────────────────────

    @workflow.run
    async def run(
        self,
        exercise_id: str,
        config_data: Dict[str, Any],
        blueprint_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        self._exercise_id = exercise_id
        retry = RetryPolicy(maximum_attempts=3, initial_interval=timedelta(seconds=2))

        # 1. Initialize state
        await workflow.execute_activity(
            create_exercise_activity,
            args=[exercise_id, config_data],
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=retry,
        )

        max_minutes = config_data.get("max_sim_minutes", 120)
        tick_minutes = 1
        real_tick_seconds = tick_minutes * 60 / config_data.get("sim_time_multiplier", 1.0)

        # 2. Simulation loop
        while self._elapsed_minutes < max_minutes and not self._stopped:
            # Pause handling
            if self._paused:
                await workflow.wait_condition(lambda: not self._paused or self._stopped)

            if self._stopped:
                break

            # Process injected events (instructor overrides)
            while self._injected_events:
                event_data = self._injected_events.pop(0)
                await workflow.execute_activity(
                    _inject_custom_event_activity,
                    args=[exercise_id, event_data],
                    start_to_close_timeout=timedelta(seconds=10),
                    retry_policy=retry,
                )

            # Process unit overrides
            while self._override_units:
                override = self._override_units.pop(0)
                await workflow.execute_activity(
                    _override_unit_activity,
                    args=[exercise_id, override],
                    start_to_close_timeout=timedelta(seconds=10),
                    retry_policy=retry,
                )

            # Tick simulation clock
            tick_result = await workflow.execute_activity(
                tick_simulation_activity,
                args=[exercise_id, tick_minutes],
                start_to_close_timeout=timedelta(seconds=15),
                retry_policy=retry,
            )
            self._elapsed_minutes = tick_result.get("elapsed_minutes", self._elapsed_minutes)
            self._active_events = tick_result.get("active_events", 0)

            # Generate new scenario events
            await workflow.execute_activity(
                run_scenario_generator_activity,
                args=[exercise_id, config_data],
                start_to_close_timeout=timedelta(seconds=20),
                retry_policy=retry,
            )

            # Run Agent Director (blueprint execution)
            if self._active_events > 0 and blueprint_data:
                await workflow.execute_activity(
                    run_director_activity,
                    args=[exercise_id, blueprint_data],
                    start_to_close_timeout=timedelta(minutes=5),
                    retry_policy=RetryPolicy(maximum_attempts=1),   # Don't retry LLM failures
                )

            # Real-time pacing: sleep scaled by sim_time_multiplier
            # MUST use workflow.sleep (not asyncio.sleep) for Temporal determinism
            sleep_secs = min(real_tick_seconds, 5.0)
            await workflow.sleep(timedelta(seconds=sleep_secs))


        # 3. Finalize
        summary = await workflow.execute_activity(
            finalize_exercise_activity,
            args=[exercise_id],
            start_to_close_timeout=timedelta(seconds=15),
            retry_policy=retry,
        )

        return summary


# ── Helper Activities (used by Signals) ────────────────────────────

@activity.defn
async def _inject_custom_event_activity(exercise_id: str, event_data: dict) -> None:
    """Write an instructor-injected event into the ExerciseState."""
    from state_store import get_state_store, ExerciseEvent
    import uuid
    
    store = await get_state_store()
    event = ExerciseEvent(
        event_id=event_data.get("event_id", f"inj_{uuid.uuid4().hex[:6]}"),
        event_type=event_data.get("event_type", "custom"),
        description=event_data.get("description", "Instructor-injected event"),
        location=tuple(event_data.get("location", (31.77, 34.75))),
        priority=event_data.get("priority", 3),
    )
    await store.add_event(exercise_id, event)
    logger.info(f"[inject_event] Injected: {event.event_type}")


@activity.defn
async def _override_unit_activity(exercise_id: str, override_data: dict) -> None:
    """Apply instructor unit override to ExerciseState."""
    from state_store import get_state_store
    
    store = await get_state_store()
    state = await store.get(exercise_id)
    if not state:
        return
    
    unit_id = override_data.get("unit_id")
    for unit in state.unit_statuses:
        if unit.unit_id == unit_id:
            updated = unit.model_copy(update={
                k: v for k, v in override_data.items() if k != "unit_id"
            })
            await store.update_unit(exercise_id, updated)
            logger.info(f"[override_unit] {unit_id} overridden: {override_data}")
            break
