"""
tests/test_node_runners.py — Unit tests for node_runners.py domain runners

Run with: pytest tests/test_node_runners.py -v
"""

import json
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from node_runners import (
    NodeRegistry, AgentState,
    state_reader_runner, state_writer_runner,
    router_node_runner, map_output_runner,
    start_runner, end_runner,
)


# ── Helpers ────────────────────────────────────────────────────────

def make_state(**kwargs) -> AgentState:
    defaults: AgentState = {
        "messages": [],
        "exercise_id": "",
        "shared_context": {},
    }
    defaults.update(kwargs)
    return defaults


# ── NodeRegistry ───────────────────────────────────────────────────

def test_all_node_types_registered():
    expected = {
        "llm", "tool_executor", "email_sender", "slack_notifier",
        "mcp_tool", "state_writer", "state_reader", "observer",
        "evaluator", "map_output", "router", "human_approval",
        "start", "end",
    }
    for node_type in expected:
        runner = NodeRegistry.get_runner(node_type)
        assert callable(runner), f"Runner for {node_type} not callable"


def test_unknown_node_type_raises():
    with pytest.raises(ValueError, match="No runner registered"):
        NodeRegistry.get_runner("does_not_exist")


# ── start / end passthrough ────────────────────────────────────────

@pytest.mark.asyncio
async def test_start_runner_passthrough():
    state = make_state(messages=[HumanMessage(content="hello")])
    result = await start_runner(state, {})
    # Should return same state unchanged
    assert result == state


@pytest.mark.asyncio
async def test_end_runner_passthrough():
    state = make_state(exercise_id="ex_1")
    result = await end_runner(state, {})
    assert result == state


# ── state_reader (shared_context) ─────────────────────────────────

@pytest.mark.asyncio
async def test_state_reader_from_context():
    state = make_state(
        shared_context={"foo": "bar", "count": 42},
    )
    result = await state_reader_runner(state, {
        "source": "shared_context",
    })
    msgs = result.get("messages", [])
    assert len(msgs) == 1
    content = msgs[0].content
    assert "foo" in content
    assert "bar" in content


@pytest.mark.asyncio
async def test_state_reader_no_exercise_id_no_crash():
    """Should return state unchanged when no exercise_id is set."""
    state = make_state(exercise_id="")
    result = await state_reader_runner(state, {"source": "exercise_state"})
    # No crash, no messages added since exercise not found
    assert result == state


# ── state_writer (shared_context merge) ───────────────────────────

@pytest.mark.asyncio
async def test_state_writer_merge_context():
    state = make_state(shared_context={"existing": 1})
    result = await state_writer_runner(state, {
        "target": "shared_context",
        "operation": "merge",
        "data_template": {"new_key": "new_val"},
    })
    assert result.get("shared_context", {}).get("new_key") == "new_val"
    assert result.get("shared_context", {}).get("existing") == 1


@pytest.mark.asyncio
async def test_state_writer_no_exercise_no_crash():
    """Writing to exercise_state with no exercise_id should be safe."""
    state = make_state(exercise_id="")
    result = await state_writer_runner(state, {
        "target": "exercise_state",
        "operation": "log_decision",
    })
    assert result is not None  # No crash


# ── router — rule_based ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_router_rule_based_eq_match():
    state = make_state(shared_context={"priority": 5})
    result = await router_node_runner(state, {
        "routing_strategy": "rule_based",
        "rules": [
            {"field": "priority", "op": "eq", "value": 5, "route": "high_priority_handler"},
        ],
    })
    msgs = result.get("messages", [])
    assert len(msgs) == 1
    assert msgs[0].content == "high_priority_handler"


@pytest.mark.asyncio
async def test_router_rule_based_gt_match():
    state = make_state(shared_context={"fatigue": 0.9})
    result = await router_node_runner(state, {
        "routing_strategy": "rule_based",
        "rules": [
            {"field": "fatigue", "op": "gt", "value": 0.85, "route": "overloaded"},
        ],
    })
    assert result["messages"][-1].content == "overloaded"


@pytest.mark.asyncio
async def test_router_rule_based_no_match_returns_default():
    state = make_state(shared_context={"priority": 1})
    result = await router_node_runner(state, {
        "routing_strategy": "rule_based",
        "rules": [
            {"field": "priority", "op": "eq", "value": 5, "route": "high"},
        ],
    })
    assert result["messages"][-1].content == "default"


@pytest.mark.asyncio
async def test_router_rule_based_contains():
    state = make_state(shared_context={"event_type": "medical_emergency"})
    result = await router_node_runner(state, {
        "routing_strategy": "rule_based",
        "rules": [
            {"field": "event_type", "op": "contains", "value": "medical", "route": "medical"},
        ],
    })
    assert result["messages"][-1].content == "medical"


# ── router — LLM (mocked) ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_router_llm_picks_valid_route():
    state = make_state(messages=[HumanMessage(content="There is a medical emergency.")])

    mock_llm = AsyncMock()
    mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="medical"))

    with patch("node_runners.ChatOpenAI", return_value=mock_llm):
        result = await router_node_runner(state, {
            "routing_strategy": "llm",
            "routes": {"medical": "Medical event", "default": "Other events"},
        })
    assert result["messages"][-1].content == "medical"


@pytest.mark.asyncio
async def test_router_llm_invalid_response_falls_back():
    state = make_state(messages=[HumanMessage(content="test")])

    mock_llm = AsyncMock()
    mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="nonexistent_route"))

    with patch("node_runners.ChatOpenAI", return_value=mock_llm):
        result = await router_node_runner(state, {
            "routing_strategy": "llm",
            "routes": {"medical": "Medical", "fire": "Fire"},
        })
    # Falls back to first route key
    assert result["messages"][-1].content in ("medical", "fire")


# ── map_output ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_map_output_no_exercise_returns_empty_geojson():
    state = make_state(exercise_id="")
    result = await map_output_runner(state, {
        "include_units": True,
        "include_events": True,
    })
    msgs = result.get("messages", [])
    assert len(msgs) == 1
    geo = json.loads(msgs[0].content)
    assert geo["type"] == "FeatureCollection"
    assert geo["features"] == []


@pytest.mark.asyncio
async def test_map_output_includes_units_and_events():
    """With a mocked store, map_output should produce GeoJSON features."""
    import fakeredis.aioredis as fakeredis
    from state_store import StateStore, ExerciseConfig, ExerciseEvent, build_initial_state

    r = fakeredis.FakeRedis(decode_responses=True)
    store = StateStore(r)
    config = ExerciseConfig(num_units=2)
    state_obj = build_initial_state("map_test", config)
    event = ExerciseEvent(
        event_id="e1", event_type="crime",
        description="Test", location=(31.77, 34.75), priority=3,
    )
    state_obj.active_events.append(event)
    await store.create(state_obj)

    agent_state = make_state(exercise_id="map_test")

    with patch("node_runners.get_state_store", return_value=AsyncMock(return_value=store)):
        # Directly call the store via patch
        pass

    # Direct test: manually call the function with a real store
    from node_runners import map_output_runner as runner
    from unittest.mock import patch, AsyncMock

    mock_store = AsyncMock()
    mock_store.get = AsyncMock(return_value=state_obj)

    with patch("node_runners.get_state_store", new=AsyncMock(return_value=mock_store)):
        result = await runner(agent_state, {"include_units": True, "include_events": True})

    msgs = result.get("messages", [])
    geo = json.loads(msgs[0].content)
    assert geo["type"] == "FeatureCollection"
    unit_features = [f for f in geo["features"] if f["properties"]["marker_type"] == "unit"]
    event_features = [f for f in geo["features"] if f["properties"]["marker_type"] == "event"]
    assert len(unit_features) == 2
    assert len(event_features) == 1


# ── llm node (mocked) ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_llm_runner_basic():
    from node_runners import llm_node_runner

    state = make_state(messages=[HumanMessage(content="What is 2+2?")])
    mock_llm = AsyncMock()
    mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="4"))

    with patch("node_runners.ChatOpenAI", return_value=mock_llm):
        result = await llm_node_runner(state, {
            "model": "gpt-4o-mini",
            "system_prompt": "You are a math assistant.",
        })

    msgs = result.get("messages", [])
    assert any(m.content == "4" for m in msgs)
