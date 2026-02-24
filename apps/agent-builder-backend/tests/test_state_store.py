"""
tests/test_state_store.py — Unit tests for state_store.py

Run with: pytest tests/test_state_store.py -v
Requires: pip install fakeredis pytest pytest-asyncio
"""

import asyncio
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch

import fakeredis.aioredis as fakeredis

from state_store import (
    StateStore, ExerciseState, ExerciseEvent, ExerciseConfig,
    AgentMessage, UnitStatus, build_initial_state,
    calculate_fatigue, get_available_units, update_unit_fatigue,
)


# ── Fixtures ───────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def store():
    r = fakeredis.FakeRedis(decode_responses=True)
    return StateStore(r)


@pytest_asyncio.fixture
async def base_config():
    return ExerciseConfig(
        scenario_type="crowd_control",
        num_units=4,
        sim_time_multiplier=5.0,
        initial_fatigue=0.1,
    )


@pytest_asyncio.fixture
async def initial_state(base_config):
    return build_initial_state("test_ex_001", base_config)


# ── build_initial_state ────────────────────────────────────────────

def test_build_initial_state_unit_count(base_config):
    state = build_initial_state("ex_001", base_config)
    assert len(state.unit_statuses) == 4


def test_build_initial_state_roles(base_config):
    state = build_initial_state("ex_001", base_config)
    roles = [u.role for u in state.unit_statuses]
    assert "patrol" in roles
    assert "commander" in roles


def test_build_initial_state_fatigue(base_config):
    state = build_initial_state("ex_001", base_config)
    for unit in state.unit_statuses:
        assert unit.fatigue == pytest.approx(0.1)


def test_build_initial_state_staggered_experience(base_config):
    state = build_initial_state("ex_001", base_config)
    experiences = [u.experience_level for u in state.unit_statuses]
    # Should be strictly increasing
    assert experiences == sorted(experiences)
    assert experiences[0] < experiences[-1]


# ── calculate_fatigue ──────────────────────────────────────────────

def test_fatigue_fresh_unit():
    unit = UnitStatus(unit_id="u1", name="U1", role="patrol",
                      location=(31.8, 34.7), current_shift_minutes=0)
    f = calculate_fatigue(unit, 0)
    assert f == pytest.approx(0.0)


def test_fatigue_full_shift():
    """After 8h shift (480min) base fatigue should be 0.8."""
    unit = UnitStatus(unit_id="u1", name="U1", role="patrol",
                      location=(31.8, 34.7), current_shift_minutes=480)
    f = calculate_fatigue(unit, 0)
    assert f == pytest.approx(0.8)


def test_fatigue_engaged_penalty():
    """Engaged unit gets +0.1 penalty."""
    unit = UnitStatus(unit_id="u1", name="U1", role="patrol",
                      location=(31.8, 34.7), current_shift_minutes=240,
                      status="engaged")
    f = calculate_fatigue(unit, 0)
    assert f > calculate_fatigue(
        unit.model_copy(update={"status": "available"}), 0
    )


def test_fatigue_resting_recovery():
    """Resting unit gains a rest bonus."""
    unit = UnitStatus(unit_id="u1", name="U1", role="patrol",
                      location=(31.8, 34.7), current_shift_minutes=120,
                      status="resting", rest_minutes=3)
    base = UnitStatus(unit_id="u1", name="U1", role="patrol",
                      location=(31.8, 34.7), current_shift_minutes=120)
    assert calculate_fatigue(unit, 0) < calculate_fatigue(base, 0)


def test_fatigue_clamped_at_1():
    unit = UnitStatus(unit_id="u1", name="U1", role="patrol",
                      location=(31.8, 34.7), current_shift_minutes=9999,
                      status="engaged")
    assert calculate_fatigue(unit, 0) <= 1.0


def test_fatigue_clamped_at_0():
    unit = UnitStatus(unit_id="u1", name="U1", role="patrol",
                      location=(31.8, 34.7), rest_minutes=9999,
                      status="resting")
    assert calculate_fatigue(unit, 0) >= 0.0


# ── get_available_units ────────────────────────────────────────────

def test_get_available_units_filters_engaged(initial_state):
    initial_state.unit_statuses[0] = initial_state.unit_statuses[0].model_copy(
        update={"status": "engaged"}
    )
    available = get_available_units(initial_state)
    assert all(u.status != "engaged" for u in available)


def test_get_available_units_filters_high_fatigue(initial_state):
    initial_state.unit_statuses[0] = initial_state.unit_statuses[0].model_copy(
        update={"fatigue": 0.90}
    )
    available = get_available_units(initial_state)
    assert all(u.fatigue < 0.85 for u in available)


# ── StateStore CRUD ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_and_get(store, initial_state):
    await store.create(initial_state)
    loaded = await store.get(initial_state.exercise_id)
    assert loaded is not None
    assert loaded.exercise_id == initial_state.exercise_id
    assert len(loaded.unit_statuses) == len(initial_state.unit_statuses)


@pytest.mark.asyncio
async def test_create_duplicate_raises(store, initial_state):
    await store.create(initial_state)
    with pytest.raises(ValueError, match="already exists"):
        await store.create(initial_state)


@pytest.mark.asyncio
async def test_get_nonexistent_returns_none(store):
    result = await store.get("does_not_exist")
    assert result is None


@pytest.mark.asyncio
async def test_delete(store, initial_state):
    await store.create(initial_state)
    await store.delete(initial_state.exercise_id)
    assert await store.get(initial_state.exercise_id) is None


# ── add_event ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_add_event(store, initial_state):
    await store.create(initial_state)
    event = ExerciseEvent(
        event_id="evt_001",
        event_type="medical",
        description="Test medical event",
        location=(31.77, 34.75),
        priority=4,
    )
    state = await store.add_event(initial_state.exercise_id, event)
    assert len(state.active_events) == 1
    assert state.active_events[0].event_id == "evt_001"


@pytest.mark.asyncio
async def test_add_event_persists(store, initial_state):
    await store.create(initial_state)
    event = ExerciseEvent(
        event_id="evt_002",
        event_type="crime",
        description="Crime scene",
        location=(31.78, 34.76),
        priority=3,
    )
    await store.add_event(initial_state.exercise_id, event)
    loaded = await store.get(initial_state.exercise_id)
    assert any(e.event_id == "evt_002" for e in loaded.active_events)


# ── resolve_event ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_resolve_event(store, initial_state):
    await store.create(initial_state)
    event = ExerciseEvent(
        event_id="evt_003", event_type="crime",
        description="Crime", location=(31.77, 34.75), priority=3,
    )
    await store.add_event(initial_state.exercise_id, event)
    state = await store.resolve_event(initial_state.exercise_id, "evt_003")
    assert not any(e.event_id == "evt_003" for e in state.active_events)
    assert any(e.event_id == "evt_003" for e in state.resolved_events)


# ── advance_time ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_advance_time(store, initial_state):
    await store.create(initial_state)
    state = await store.advance_time(initial_state.exercise_id, 5)
    assert state.elapsed_minutes == 5


@pytest.mark.asyncio
async def test_advance_time_accumulates(store, initial_state):
    await store.create(initial_state)
    await store.advance_time(initial_state.exercise_id, 3)
    state = await store.advance_time(initial_state.exercise_id, 7)
    assert state.elapsed_minutes == 10


# ── log_decision ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_log_decision(store, initial_state):
    await store.create(initial_state)
    decision = {
        "agent": "director",
        "assigned_units": ["unit_001"],
        "reasoning": "Closest available unit",
    }
    state = await store.log_decision(initial_state.exercise_id, decision)
    assert len(state.decisions_log) == 1
    assert state.decisions_log[0]["agent"] == "director"
    assert "timestamp" in state.decisions_log[0]


# ── message queue ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_push_and_pop_messages(store, initial_state):
    await store.create(initial_state)
    msg = AgentMessage(
        from_agent="dispatcher",
        to_agent="unit_001",
        message_type="task_assignment",
        payload={"event_id": "evt_001"},
    )
    await store.push_message(initial_state.exercise_id, msg)
    popped = await store.pop_messages(initial_state.exercise_id, 1)
    assert len(popped) == 1
    assert popped[0].from_agent == "dispatcher"


@pytest.mark.asyncio
async def test_peek_does_not_consume(store, initial_state):
    await store.create(initial_state)
    msg = AgentMessage(
        from_agent="a", to_agent="b",
        message_type="alert", payload={"x": 1},
    )
    await store.push_message(initial_state.exercise_id, msg)
    await store.peek_messages(initial_state.exercise_id)
    # Message still there after peek
    remaining = await store.pop_messages(initial_state.exercise_id, 10)
    assert len(remaining) == 1


# ── Concurrency / Race Condition ───────────────────────────────────

@pytest.mark.asyncio
async def test_concurrent_add_events_no_data_loss(store, initial_state):
    """Fire 10 concurrent add_event calls — all should persist (no lost updates)."""
    await store.create(initial_state)

    async def add_one(i: int):
        evt = ExerciseEvent(
            event_id=f"evt_{i:03d}",
            event_type="crime",
            description=f"Event {i}",
            location=(31.77, 34.75),
            priority=3,
        )
        await store.add_event(initial_state.exercise_id, evt)

    await asyncio.gather(*[add_one(i) for i in range(10)])

    final = await store.get(initial_state.exercise_id)
    assert len(final.active_events) == 10, (
        f"Expected 10 events (no lost updates), got {len(final.active_events)}"
    )
