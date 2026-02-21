"""
state_store.py — Phase 1: Shared World State Layer

Provides:
 - Pydantic models for ExerciseState, UnitStatus, ExerciseConfig, AgentMessage
 - StateStore: Redis-backed CRUD for ExerciseState (one hash per exercise)
 - get_state_store(): FastAPI/worker dependency
"""

import json
import asyncio
from datetime import datetime
from typing import Any

import redis.asyncio as aioredis
from pydantic import BaseModel, Field

# ── Domain Models ──────────────────────────────────────────────────


class UnitStatus(BaseModel):
    unit_id: str
    name: str
    role: str                         # "patrol" | "commander" | "medic"
    location: tuple[float, float]     # (lat, lng)
    fatigue: float = 0.0              # 0.0 = fresh, 1.0 = exhausted
    experience_level: float = 0.5    # 0.0 = rookie, 1.0 = veteran
    status: str = "available"         # available | en_route | engaged | resting
    current_task: str | None = None
    current_shift_minutes: int = 0
    rest_minutes: int = 0


class ExerciseEvent(BaseModel):
    event_id: str
    event_type: str                   # "crime" | "medical" | "traffic" | "crowd"
    description: str
    location: tuple[float, float]     # (lat, lng)
    priority: int = 3                 # 1 (low) — 5 (critical)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    assigned_units: list[str] = Field(default_factory=list)
    status: str = "active"            # active | resolved


class ExerciseState(BaseModel):
    exercise_id: str
    scenario_name: str
    elapsed_minutes: int = 0
    active_events: list[ExerciseEvent] = Field(default_factory=list)
    unit_statuses: list[UnitStatus] = Field(default_factory=list)
    resolved_events: list[ExerciseEvent] = Field(default_factory=list)
    decisions_log: list[dict] = Field(default_factory=list)
    agent_messages: list[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_running: bool = False


class ExerciseConfig(BaseModel):
    scenario_type: str = "crowd_control"          # port_incident | crowd_control | terror_attack
    num_units: int = 6
    sim_time_multiplier: float = 1.0              # 1.0 = realtime, 10.0 = 10x faster
    initial_fatigue: float = 0.1                  # starting fatigue for all units
    inject_chaos: bool = False                    # surprise mid-exercise events
    assessment_mode: bool = True                  # enable Langfuse scoring
    languages: list[str] = Field(default_factory=lambda: ["he", "en"])
    max_sim_minutes: int = 120                    # stop after this many sim minutes


class AgentMessage(BaseModel):
    message_id: str = Field(default_factory=lambda: f"msg_{datetime.utcnow().timestamp()}")
    from_agent: str
    to_agent: str                                 # agent name or "broadcast"
    message_type: str                             # task_assignment | status_update | alert | request
    payload: dict
    priority: int = 3                             # 1 (low) — 5 (critical)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    acknowledged: bool = False


# ── Domain Logic ───────────────────────────────────────────────────


def calculate_fatigue(unit: UnitStatus, elapsed_minutes: int) -> float:
    """
    Fatigue increases over shift time and active engagement.
    Rest reduces it. Capped at [0.0, 1.0].
    """
    base = min(unit.current_shift_minutes / 480, 0.8)   # 8hr shift = 0.8 max base
    active_penalty = 0.1 if unit.status == "engaged" else 0.0
    rest_bonus = 0.05 * unit.rest_minutes if unit.status == "resting" else 0.0
    return max(0.0, min(1.0, base + active_penalty - rest_bonus))


def update_unit_fatigue(state: ExerciseState) -> ExerciseState:
    """Apply fatigue calculation to all units in the state."""
    updated = []
    for unit in state.unit_statuses:
        new_fatigue = calculate_fatigue(unit, state.elapsed_minutes)
        updated.append(unit.model_copy(update={"fatigue": new_fatigue}))
    return state.model_copy(update={"unit_statuses": updated})


def get_available_units(state: ExerciseState, max_fatigue: float = 0.85) -> list[UnitStatus]:
    """Return units below fatigue threshold that are not already engaged."""
    return [
        u for u in state.unit_statuses
        if u.status in ("available", "resting") and u.fatigue < max_fatigue
    ]


def build_dispatcher_prompt(event: ExerciseEvent, state: ExerciseState) -> str:
    """Build a dynamic dispatcher prompt from the live exercise state."""
    available = get_available_units(state)
    unit_lines = "\n".join(
        f"- {u.name} ({u.role}):\n"
        f"  Fatigue: {u.fatigue:.0%} | Experience: {u.experience_level:.0%}\n"
        f"  Location: {u.location} | Status: {u.status}"
        for u in available
    )
    return f"""You are the Police Dispatch Commander. You have a new incident:

Event: {event.description}
Type: {event.event_type}
Priority: {event.priority}/5
Location: {event.location}

Available Units ({len(available)} of {len(state.unit_statuses)}):
{unit_lines or "No units available"}

Exercise time: T+{state.elapsed_minutes}min

Critical rules:
1. Do NOT assign a unit with fatigue > 0.85 to a high-priority (≥4) incident
2. Prefer veteran units (experience > 0.7) for crowd-control events
3. Medical incidents require a unit be on-site within 8 minutes
4. If no unit is available, escalate with message_type="alert"

Respond with a JSON object:
{{
  "assigned_units": ["unit_id_1", ...],
  "reasoning": "...",
  "escalate": false,
  "estimated_arrival_minutes": 5
}}"""


# ── State Store (Redis) ────────────────────────────────────────────

REDIS_EXERCISE_PREFIX = "exercise:"
REDIS_MESSAGES_PREFIX = "messages:"


class StateStore:
    """
    Redis-backed store for ExerciseState objects.
    Each exercise is stored as a JSON string at key "exercise:{exercise_id}".
    Agent messages are stored in a Redis list at "messages:{exercise_id}".

    Thread-safety: all read-modify-write mutations acquire a per-exercise
    asyncio.Lock to prevent concurrent-agent corruption.
    """

    def __init__(self, redis: aioredis.Redis):
        self._r = redis
        # Per-exercise async locks — WeakValueDict so GC'd when no longer held
        import weakref
        self._locks: weakref.WeakValueDictionary[str, asyncio.Lock] = weakref.WeakValueDictionary()

    def _lock(self, exercise_id: str) -> asyncio.Lock:
        """Get-or-create a per-exercise asyncio.Lock."""
        lock = self._locks.get(exercise_id)
        if lock is None:
            lock = asyncio.Lock()
            self._locks[exercise_id] = lock
        return lock

    # ── ExerciseState CRUD ─────────────────────────────────────────

    def _key(self, exercise_id: str) -> str:
        return f"{REDIS_EXERCISE_PREFIX}{exercise_id}"

    async def create(self, state: ExerciseState) -> ExerciseState:
        """Persist a new ExerciseState. Raises if it already exists."""
        async with self._lock(state.exercise_id):
            key = self._key(state.exercise_id)
            existing = await self._r.get(key)
            if existing:
                raise ValueError(f"Exercise {state.exercise_id} already exists")
            await self._r.set(key, state.model_dump_json())
            return state

    async def get(self, exercise_id: str) -> ExerciseState | None:
        """Load exercise state. Returns None if not found."""
        raw = await self._r.get(self._key(exercise_id))
        if not raw:
            return None
        return ExerciseState.model_validate_json(raw)

    async def save(self, state: ExerciseState) -> ExerciseState:
        """Overwrite the full state. Call while already holding the lock."""
        state = state.model_copy(update={"updated_at": datetime.utcnow()})
        await self._r.set(self._key(state.exercise_id), state.model_dump_json())
        return state

    async def delete(self, exercise_id: str) -> None:
        async with self._lock(exercise_id):
            await self._r.delete(self._key(exercise_id))
            await self._r.delete(f"{REDIS_MESSAGES_PREFIX}{exercise_id}")

    # ── Partial Update Helpers (atomic via lock) ───────────────────

    async def add_event(self, exercise_id: str, event: ExerciseEvent) -> ExerciseState:
        async with self._lock(exercise_id):
            state = await self.get(exercise_id)
            if not state:
                raise ValueError(f"Exercise {exercise_id} not found")
            state.active_events.append(event)
            return await self.save(state)

    async def resolve_event(self, exercise_id: str, event_id: str) -> ExerciseState:
        async with self._lock(exercise_id):
            state = await self.get(exercise_id)
            if not state:
                raise ValueError(f"Exercise {exercise_id} not found")
            remaining, resolved = [], []
            for evt in state.active_events:
                if evt.event_id == event_id:
                    resolved.append(evt.model_copy(update={"status": "resolved"}))
                else:
                    remaining.append(evt)
            state.active_events = remaining
            state.resolved_events.extend(resolved)
            return await self.save(state)

    async def update_unit(self, exercise_id: str, unit: UnitStatus) -> ExerciseState:
        async with self._lock(exercise_id):
            state = await self.get(exercise_id)
            if not state:
                raise ValueError(f"Exercise {exercise_id} not found")
            state.unit_statuses = [
                unit if u.unit_id == unit.unit_id else u
                for u in state.unit_statuses
            ]
            return await self.save(state)

    async def log_decision(self, exercise_id: str, decision: dict) -> ExerciseState:
        async with self._lock(exercise_id):
            state = await self.get(exercise_id)
            if not state:
                raise ValueError(f"Exercise {exercise_id} not found")
            decision["timestamp"] = datetime.utcnow().isoformat()
            state.decisions_log.append(decision)
            return await self.save(state)

    async def advance_time(self, exercise_id: str, minutes: int = 1) -> ExerciseState:
        """Tick the simulation clock forward and recalculate fatigue."""
        async with self._lock(exercise_id):
            state = await self.get(exercise_id)
            if not state:
                raise ValueError(f"Exercise {exercise_id} not found")
            state = state.model_copy(update={"elapsed_minutes": state.elapsed_minutes + minutes})
            state = update_unit_fatigue(state)
            return await self.save(state)

    # ── Agent Messages (Redis List) ────────────────────────────────

    async def push_message(self, exercise_id: str, msg: AgentMessage) -> None:
        """Push a message to the exercise message queue."""
        key = f"{REDIS_MESSAGES_PREFIX}{exercise_id}"
        await self._r.rpush(key, msg.model_dump_json())

    async def pop_messages(self, exercise_id: str, count: int = 10) -> list[AgentMessage]:
        """Pop up to `count` messages from the queue (FIFO)."""
        key = f"{REDIS_MESSAGES_PREFIX}{exercise_id}"
        pipe = self._r.pipeline()
        for _ in range(count):
            pipe.lpop(key)
        results = await pipe.execute()
        messages = []
        for raw in results:
            if raw:
                messages.append(AgentMessage.model_validate_json(raw))
        return messages

    async def peek_messages(self, exercise_id: str, count: int = 20) -> list[AgentMessage]:
        """Read messages without consuming them."""
        key = f"{REDIS_MESSAGES_PREFIX}{exercise_id}"
        results = await self._r.lrange(key, 0, count - 1)
        return [AgentMessage.model_validate_json(r) for r in results]



# ── Singleton / Dependency ─────────────────────────────────────────

_redis_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    """Return (or create) the shared async Redis client."""
    global _redis_client
    if _redis_client is None:
        import os
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _redis_client = aioredis.from_url(redis_url, decode_responses=True)
    return _redis_client


async def get_state_store() -> StateStore:
    """FastAPI dependency / worker helper — returns a StateStore instance."""
    redis = await get_redis()
    return StateStore(redis)


# ── Template Builder ───────────────────────────────────────────────

def build_initial_state(exercise_id: str, config: ExerciseConfig) -> ExerciseState:
    """
    Build the initial ExerciseState from a config.
    Generates `config.num_units` patrol units with staggered experience.
    """
    import uuid
    units = []
    roles_cycle = ["patrol", "patrol", "commander", "medic", "patrol", "commander"]
    for i in range(config.num_units):
        role = roles_cycle[i % len(roles_cycle)]
        units.append(UnitStatus(
            unit_id=f"unit_{str(uuid.uuid4())[:8]}",
            name=f"Unit {i + 1:02d}",
            role=role,
            location=(31.8 + i * 0.01, 34.7 + i * 0.01),   # Tel Aviv area stagger
            fatigue=config.initial_fatigue,
            experience_level=round(0.3 + (i / config.num_units) * 0.7, 2),
        ))

    return ExerciseState(
        exercise_id=exercise_id,
        scenario_name=config.scenario_type,
        unit_statuses=units,
        is_running=False,
    )
