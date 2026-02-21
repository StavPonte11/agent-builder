"""
node_runners.py — Extended with domain-specific node runners (Phase 3)

New runners:
 - state_writer: Write key/value into shared ExerciseState
 - state_reader: Read fields from ExerciseState into agent messages
 - observer: Extract entities from decisions log into Cognee KG
 - evaluator: Score agent decisions via Langfuse
 - map_output: Format unit/event data as GeoJSON
 - router: LLM-based or rule-based conditional routing
 - human_approval: Pause workflow, emit approval request
"""

import json
import logging
from typing import Annotated, Any, Callable, Awaitable, Optional
from typing_extensions import TypedDict

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, BaseMessage
from langgraph.graph.message import add_messages

logger = logging.getLogger(__name__)

# ── State Schema ───────────────────────────────────────────────────

class AgentState(TypedDict, total=False):
    """
    LangGraph-compatible state TypedDict.
    - `messages` uses the built-in add_messages reducer (append-only)
    - `exercise_id` / `shared_context` are plain values (last-write-wins)
    """
    messages: Annotated[list, add_messages]
    exercise_id: str
    shared_context: dict


RunnerFunc = Callable[[AgentState, Dict[str, Any]], Awaitable[AgentState]]


class NodeRegistry:
    _runners: Dict[str, RunnerFunc] = {}

    @classmethod
    def register(cls, node_type: str):
        def decorator(func: RunnerFunc):
            cls._runners[node_type] = func
            return func
        return decorator

    @classmethod
    def get_runner(cls, node_type: str) -> RunnerFunc:
        runner = cls._runners.get(node_type)
        if not runner:
            raise ValueError(f"No runner registered for node type: {node_type}")
        return runner


# ── Core Runners (existing, unchanged) ────────────────────────────

@NodeRegistry.register("llm")
async def llm_node_runner(state: AgentState, config: Dict[str, Any]) -> AgentState:
    """
    Standard LLM Node.
    Config: model, temperature, system_prompt, max_tokens
    Optional: inject_exercise_context=True → prepends ExerciseState summary
    """
    model_name = config.get("model", "gpt-4o")
    temperature = config.get("temperature", 0.7)
    system_prompt = config.get("system_prompt", "You are a helpful assistant.")
    max_tokens = config.get("max_tokens", 1000)

    # Optionally enrich with exercise context
    if config.get("inject_exercise_context") and state.get("exercise_id"):
        from state_store import get_state_store
        store = await get_state_store()
        ex_state = await store.get(state["exercise_id"])
        if ex_state:
            system_prompt += f"\n\nCurrent exercise state summary:\n" \
                             f"- Elapsed: T+{ex_state.elapsed_minutes}min\n" \
                             f"- Active events: {len(ex_state.active_events)}\n" \
                             f"- Available units: {sum(1 for u in ex_state.unit_statuses if u.status == 'available')}/{len(ex_state.unit_statuses)}"

    llm = ChatOpenAI(model=model_name, temperature=temperature, max_tokens=max_tokens)
    formatted_messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = await llm.ainvoke(formatted_messages)
    return {"messages": [response]}


@NodeRegistry.register("tool_executor")
async def tool_node_runner(state: AgentState, config: Dict[str, Any]) -> AgentState:
    """
    Tool Executor Node — calls MCP tools dynamically.
    Config: servers (list of MCP server names), allowed_tools (list of tool names)
    """
    servers = config.get("servers", [])
    allowed_tools = config.get("allowed_tools", [])
    logger.info(f"[tool_executor] servers={servers}, allowed_tools={allowed_tools}")
    # Placeholder: integrate with MCP client in production
    return state


@NodeRegistry.register("email_sender")
async def email_node_runner(state: AgentState, config: Dict[str, Any]) -> AgentState:
    recipient = config.get("recipient", "admin@example.com")
    subject = config.get("subject", "Agent Notification")
    body = config.get("body_template", "Notification from agent.")
    logger.info(f"[email_sender] To: {recipient} | Subject: {subject}")
    return state


@NodeRegistry.register("slack_notifier")
async def slack_node_runner(state: AgentState, config: Dict[str, Any]) -> AgentState:
    webhook_url = config.get("webhook_url")
    message = config.get("message", "Hello from Agent")
    if webhook_url:
        import httpx
        async with httpx.AsyncClient() as client:
            await client.post(webhook_url, json={"text": message})
    logger.info(f"[slack_notifier] {message}")
    return state


@NodeRegistry.register("mcp_tool")
async def mcp_node_runner(state: AgentState, config: Dict[str, Any]) -> AgentState:
    server_name = config.get("server_name")
    tool_name = config.get("tool_name")
    arguments = config.get("arguments", {})
    logger.info(f"[mcp_tool] {server_name}.{tool_name}({arguments})")
    result = f"Result from {tool_name}: Success"
    return {"messages": [AIMessage(content=result)]}


# ── Domain Node Runners (Phase 3) ─────────────────────────────────

@NodeRegistry.register("state_writer")
async def state_writer_runner(state: AgentState, config: Dict[str, Any]) -> AgentState:
    """
    State Writer Node — writes structured data into shared ExerciseState.
    
    Config:
      - target: str  ("exercise_state" | "shared_context")
      - operation: str  ("merge" | "append_event" | "update_unit" | "log_decision")
      - data_template: dict  (static data to merge/write)
      - extract_from_last_message: bool  (parse JSON from last AI message)
    """
    exercise_id = state.get("exercise_id", "")
    target = config.get("target", "shared_context")
    operation = config.get("operation", "merge")

    if target == "exercise_state" and exercise_id:
        from state_store import get_state_store
        store = await get_state_store()
        data = config.get("data_template", {})

        # Optionally extract JSON from last AI message
        if config.get("extract_from_last_message"):
            last = state["messages"][-1] if state["messages"] else None
            if last and hasattr(last, "content"):
                try:
                    data = json.loads(last.content)
                except json.JSONDecodeError:
                    # Try to extract JSON block from markdown
                    import re
                    match = re.search(r'\{.*\}', last.content, re.DOTALL)
                    if match:
                        try:
                            data = json.loads(match.group())
                        except Exception:
                            logger.warning("[state_writer] Could not parse JSON from message")

        exercise_state = await store.get(exercise_id)
        if exercise_state:
            if operation == "log_decision":
                await store.log_decision(exercise_id, data)
            elif operation == "advance_time":
                minutes = data.get("minutes", 1)
                await store.advance_time(exercise_id, minutes)
            else:
                # Generic merge — advance updated_at
                updated = exercise_state.model_copy(update=data)
                await store.save(updated)
            logger.info(f"[state_writer] {operation} on exercise {exercise_id}")

    elif target == "shared_context":
        ctx = dict(state.get("shared_context", {}))
        ctx.update(config.get("data_template", {}))
        return {"shared_context": ctx}

    return state


@NodeRegistry.register("state_reader")
async def state_reader_runner(state: AgentState, config: Dict[str, Any]) -> AgentState:
    """
    State Reader Node — reads ExerciseState fields and injects into agent messages.
    
    Config:
      - source: str  ("exercise_state" | "shared_context")
      - fields: list[str]  (which top-level fields to read, e.g. ["unit_statuses", "active_events"])
      - format: str  ("json" | "natural_language")
    """
    exercise_id = state.get("exercise_id", "")
    source = config.get("source", "exercise_state")
    fields = config.get("fields", [])
    fmt = config.get("format", "json")

    if source == "exercise_state" and exercise_id:
        from state_store import get_state_store
        store = await get_state_store()
        exercise_state = await store.get(exercise_id)
        if exercise_state:
            if fields:
                data = {f: getattr(exercise_state, f, None) for f in fields}
            else:
                data = exercise_state.model_dump()

            if fmt == "natural_language":
                units = exercise_state.unit_statuses
                avail = sum(1 for u in units if u.status == "available")
                summary = (
                    f"Exercise T+{exercise_state.elapsed_minutes}min: "
                    f"{len(exercise_state.active_events)} active events, "
                    f"{avail}/{len(units)} units available."
                )
                content = summary
            else:
                content = json.dumps(data, default=str)

            return {"messages": [HumanMessage(content=f"[STATE] {content}")]}

    elif source == "shared_context":
        ctx = state.get("shared_context", {})
        content = json.dumps(ctx, default=str)
        return {"messages": [HumanMessage(content=f"[CONTEXT] {content}")]}

    return state


@NodeRegistry.register("observer")
async def observer_runner(state: AgentState, config: Dict[str, Any]) -> AgentState:
    """
    Observer Agent Node — extracts entities from agent decisions and writes to Cognee KG.
    
    Config:
      - cognee_enabled: bool  (default True)
      - extract_entities: bool
      - langfuse_enabled: bool
      - data_set: str  (Cognee dataset name, defaults to exercise_id)
    """
    exercise_id = state.get("exercise_id", "")
    cognee_enabled = config.get("cognee_enabled", True)
    extract_entities = config.get("extract_entities", True)

    if not exercise_id:
        logger.warning("[observer] No exercise_id in state, skipping")
        return state

    from state_store import get_state_store
    store = await get_state_store()
    exercise_state = await store.get(exercise_id)
    if not exercise_state:
        return state

    decisions = exercise_state.decisions_log
    if not decisions:
        logger.info("[observer] No decisions to observe yet")
        return state

    # Build a narrative from the decisions log for Cognee ingestion
    narrative_parts = []
    for d in decisions[-10:]:   # last 10 decisions
        agent = d.get("agent", "unknown")
        reasoning = d.get("reasoning", "")
        units = d.get("assigned_units", [])
        narrative_parts.append(
            f"Agent {agent} assigned {units} with reasoning: {reasoning}"
        )
    narrative = "\n".join(narrative_parts)

    if cognee_enabled and extract_entities and narrative:
        try:
            import cognee
            dataset_name = config.get("data_set", exercise_id)
            await cognee.add(narrative, dataset_name=dataset_name)
            await cognee.cognify()
            logger.info(f"[observer] Cognee KG updated for exercise {exercise_id}")
        except ImportError:
            logger.warning("[observer] Cognee not installed, skipping KG update")
        except Exception as e:
            logger.error(f"[observer] Cognee error: {e}")

    summary = f"Observed {len(decisions)} decisions. Entities extracted to KG."
    return {"messages": [AIMessage(content=summary)]}


@NodeRegistry.register("evaluator")
async def evaluator_runner(state: AgentState, config: Dict[str, Any]) -> AgentState:
    """
    Evaluator Node — scores agent decisions and emits metrics to Langfuse.
    
    Config:
      - metrics: list[str]  (["fatigue_compliance", "response_time", "decision_quality"])
      - langfuse_enabled: bool
      - langfuse_dataset: str
      - scoring_prompt: str  (optional override for LLM-based scoring)
    """
    exercise_id = state.get("exercise_id", "")
    langfuse_enabled = config.get("langfuse_enabled", True)
    metrics = config.get("metrics", ["decision_quality"])

    scores: dict[str, float] = {}

    if exercise_id:
        from state_store import get_state_store
        store = await get_state_store()
        exercise_state = await store.get(exercise_id)

        if exercise_state:
            decisions = exercise_state.decisions_log

            # ── Fatigue Compliance Score ───────────────────────
            if "fatigue_compliance" in metrics:
                violations = sum(
                    1 for d in decisions
                    if any(
                        u.fatigue > 0.85
                        for u in exercise_state.unit_statuses
                        if u.unit_id in d.get("assigned_units", [])
                    )
                )
                total = max(len(decisions), 1)
                scores["fatigue_compliance"] = 1.0 - (violations / total)

            # ── Safety Score (no critical + high fatigue unit) ─
            if "safety" in metrics:
                critical_violations = sum(
                    1 for d in decisions
                    if d.get("priority", 0) >= 4 and any(
                        u.fatigue > 0.85
                        for u in exercise_state.unit_statuses
                        if u.unit_id in d.get("assigned_units", [])
                    )
                )
                scores["safety"] = 1.0 - min(critical_violations / max(len(decisions), 1), 1.0)

            # ── Decision Quality (LLM-based) ───────────────────
            if "decision_quality" in metrics and decisions:
                scoring_prompt = config.get("scoring_prompt", "")
                last_decisions_str = json.dumps(decisions[-5:], default=str, indent=2)
                llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
                prompt = scoring_prompt or (
                    "Rate the quality of these police dispatch decisions on a scale of 0.0–1.0. "
                    "Consider: appropriate unit selection, fatigue awareness, urgency matching. "
                    "Reply with only a float number.\n\nDecisions:\n" + last_decisions_str
                )
                response = await llm.ainvoke([HumanMessage(content=prompt)])
                try:
                    scores["decision_quality"] = float(response.content.strip())
                except ValueError:
                    scores["decision_quality"] = 0.5

    # ── Emit to Langfuse ───────────────────────────────────────
    if langfuse_enabled and scores:
        try:
            import os
            from langfuse import Langfuse
            lf = Langfuse(
                public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
                secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
                host=os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com"),
            )
            trace = lf.trace(name=f"evaluator_{exercise_id}")
            for metric, value in scores.items():
                trace.score(name=metric, value=value)
            lf.flush()
            logger.info(f"[evaluator] Scores emitted to Langfuse: {scores}")
        except ImportError:
            logger.warning("[evaluator] Langfuse not installed")
        except Exception as e:
            logger.error(f"[evaluator] Langfuse error: {e}")

    summary = f"Evaluation complete. Scores: {scores}"
    return {"messages": [AIMessage(content=summary)]}


@NodeRegistry.register("map_output")
async def map_output_runner(state: AgentState, config: Dict[str, Any]) -> AgentState:
    """
    Map Output Node — formats ExerciseState into GeoJSON for frontend map.
    
    Config:
      - include_units: bool  (default True)
      - include_events: bool  (default True)
      - include_routes: bool  (default False - future: routing polylines)
    """
    exercise_id = state.get("exercise_id", "")
    include_units = config.get("include_units", True)
    include_events = config.get("include_events", True)

    features = []

    if exercise_id:
        from state_store import get_state_store
        store = await get_state_store()
        exercise_state = await store.get(exercise_id)

        if exercise_state:
            if include_units:
                for unit in exercise_state.unit_statuses:
                    lat, lng = unit.location
                    features.append({
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [lng, lat]},
                        "properties": {
                            "id": unit.unit_id,
                            "name": unit.name,
                            "role": unit.role,
                            "status": unit.status,
                            "fatigue": round(unit.fatigue, 2),
                            "experience": round(unit.experience_level, 2),
                            "marker_type": "unit",
                            "color": "#6366f1" if unit.status == "available"
                                     else "#ef4444" if unit.status == "engaged"
                                     else "#f59e0b",
                        }
                    })

            if include_events:
                for event in exercise_state.active_events:
                    lat, lng = event.location
                    features.append({
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [lng, lat]},
                        "properties": {
                            "id": event.event_id,
                            "type": event.event_type,
                            "description": event.description,
                            "priority": event.priority,
                            "status": event.status,
                            "timestamp": event.timestamp.isoformat(),
                            "marker_type": "event",
                            "color": "#ef4444" if event.priority >= 4
                                     else "#f59e0b" if event.priority >= 3
                                     else "#10b981",
                        }
                    })

    geojson = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "exercise_id": exercise_id,
            "feature_count": len(features),
        }
    }

    return {"messages": [AIMessage(content=json.dumps(geojson))]}


@NodeRegistry.register("router")
async def router_node_runner(state: AgentState, config: Dict[str, Any]) -> AgentState:
    """
    Router Node — LLM-based or rule-based conditional routing.
    
    Returns the state unchanged; the routing decision is encoded in the
    last message content as a route key string.
    LangGraph reads this via add_conditional_edges().
    
    Config:
      - routing_strategy: "llm" | "rule_based"
      - routes: dict  (label → description, for LLM routing)
      - rules: list[dict]  (for rule_based: [{field, op, value, route}])
      - route_field: str  (state field to evaluate for rule-based)
    """
    strategy = config.get("routing_strategy", "llm")

    if strategy == "rule_based":
        rules = config.get("rules", [])
        context = state.get("shared_context", {})
        for rule in rules:
            field = rule.get("field", "")
            op = rule.get("op", "eq")
            value = rule.get("value")
            route = rule.get("route", "default")
            actual = context.get(field)
            if op == "eq" and actual == value:
                return {"messages": [AIMessage(content=route)]}
            elif op == "gt" and actual is not None and actual > value:
                return {"messages": [AIMessage(content=route)]}
            elif op == "lt" and actual is not None and actual < value:
                return {"messages": [AIMessage(content=route)]}
            elif op == "contains" and actual is not None and value in str(actual):
                return {"messages": [AIMessage(content=route)]}
        return {"messages": [AIMessage(content="default")]}

    else:  # LLM routing
        routes = config.get("routes", {})
        route_descriptions = "\n".join(f"- {k}: {v}" for k, v in routes.items())
        last_msg = state["messages"][-1].content if state["messages"] else ""
        prompt = (
            f"Based on this message, choose the most appropriate route.\n\n"
            f"Message: {last_msg}\n\n"
            f"Routes:\n{route_descriptions}\n\n"
            f"Reply with ONLY the route name (one word):"
        )
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        route = response.content.strip().lower()
        if route not in routes:
            route = list(routes.keys())[0] if routes else "default"
        return {"messages": [AIMessage(content=route)]}


@NodeRegistry.register("human_approval")
async def human_approval_runner(state: AgentState, config: Dict[str, Any]) -> AgentState:
    """
    Human Approval Node — emits an approval request and halts.
    The Temporal workflow waits for an external Signal to proceed.
    
    Config:
      - timeout_seconds: int  (default 3600)
      - required_role: str  (e.g. "instructor", "admin")
      - approval_prompt: str  (message shown to approver)
    """
    timeout = config.get("timeout_seconds", 3600)
    required_role = config.get("required_role", "instructor")
    approval_prompt = config.get("approval_prompt", "Please review and approve this action.")

    # Publish approval request to Redis for the API to expose
    exercise_id = state.get("exercise_id", "")
    if exercise_id:
        from agent_messages import create_message_bus
        from state_store import AgentMessage
        import uuid

        bus = await create_message_bus(exercise_id)
        msg = AgentMessage(
            from_agent="human_approval_node",
            to_agent="broadcast",
            message_type="approval_request",
            payload={
                "prompt": approval_prompt,
                "required_role": required_role,
                "timeout_seconds": timeout,
                "state_snapshot": {
                    "messages_count": len(state["messages"]),
                    "exercise_id": exercise_id,
                }
            },
            priority=5,
        )
        await bus.publish(msg)
        logger.info(f"[human_approval] Approval requested for exercise {exercise_id}")

    # The workflow is expected to pause via Temporal Signal
    # Return state unchanged — the Temporal workflow will handle the wait
    return {"messages": [AIMessage(content="AWAITING_HUMAN_APPROVAL")]}


@NodeRegistry.register("start")
async def start_runner(state: AgentState, config: Dict[str, Any]) -> AgentState:
    """Entry-point node — passes state through."""
    return state


@NodeRegistry.register("end")
async def end_runner(state: AgentState, config: Dict[str, Any]) -> AgentState:
    """Terminal node — logs completion."""
    logger.info(f"[end] Workflow completed for exercise {state.get('exercise_id', 'unknown')}")
    return state
