# How the Platform Compiles and Runs Blueprints

This document explains the lifecycle of a blueprint from JSON saved in the UI to actual code running in production.

---

## The Short Answer

```
UI Canvas (React Flow JSON)
    │  POST /blueprints
    ▼
PostgreSQL: blueprints.definition (JSONB)
    │  User clicks "Execute" → POST /executions
    ▼
Temporal: ExecuteBlueprintWorkflow
    │  Activity 1: compile_blueprint_activity
    ▼
BlueprintCompiler.compile(definition)
    │  Iterates nodes, maps each type → LangGraph node function
    ▼
LangGraph StateGraph (in memory)
    │  Activity 2: execute_langgraph_activity
    ▼
compiled_graph.ainvoke(initial_state)
    │  Each node runs → streams events over WebSocket
    ▼
PostgreSQL: executions.output_data + node checkpoints
```

---

## Step 1 — The Canvas JSON (demo_blueprint.json)

The UI uses **React Flow** to let users drag-and-drop nodes onto a canvas. When saved, the graph is serialized to a simple JSON schema:

```json
{
  "nodes": [
    { "id": "t1", "type": "trigger",  "position": {"x":100,"y":300}, "data": { ... } },
    { "id": "l1", "type": "llm",      "position": {"x":380,"y":300}, "data": { "model":"gpt-4o", ... } },
    { "id": "o1", "type": "output",   "position": {"x":680,"y":300}, "data": { ... } }
  ],
  "edges": [
    { "id":"e1", "source":"t1", "target":"l1" },
    { "id":"e2", "source":"l1", "target":"o1" }
  ]
}
```

This JSON is stored verbatim in **`blueprints.definition`** (PostgreSQL JSONB column).

---

## Step 2 — The API Layer (FastAPI)

When a user POSTs to `/api/v1/executions`:

```python
# api/v1/executions.py
execution = Execution(
    blueprint_id=blueprint.id,
    status=ExecutionStatus.QUEUED,
    input_data=input_data,
    ...
)
# Hand off to Temporal (durable execution engine)
await temporal_client.start_workflow(
    ExecuteBlueprintWorkflow.run,
    {"definition": blueprint.definition, "input": input_data},
    ...
)
```

The execution record is immediately created in the DB with `status=queued`.

---

## Step 3 — Temporal Orchestration (temporal_worker.py)

**Temporal** is the durable workflow engine. It guarantees:
- Automatic retries on failures
- Persistence of workflow state (survives crashes/restarts)
- Parallel activity execution

```python
@workflow.defn
class ExecuteBlueprintWorkflow:
    @workflow.run
    async def run(self, execution_request: dict) -> dict:
        definition = execution_request["definition"]
        input_data = execution_request["input"]

        # Activity 1: Validate the blueprint compiles
        await workflow.execute_activity(
            compile_blueprint_activity,
            definition,
            start_to_close_timeout=timedelta(seconds=10),
        )

        # Activity 2 (optional): Guardrail check (PII/injection detection)
        if input_data.get("requires_guardrails"):
            safe = await workflow.execute_activity(check_guardrails_activity, ...)

        # Activity 3: Actually execute the graph
        result = await workflow.execute_activity(
            execute_langgraph_activity,
            args=[definition, input_data],
            start_to_close_timeout=timedelta(minutes=5),
        )
        return result
```

---

## Step 4 — The Compiler (workflow_engine.BlueprintCompiler)

This is the core translation layer. `BlueprintCompiler.compile(definition)` turns the JSON into a real **LangGraph StateGraph**:

```python
class BlueprintCompiler:
    NODE_TYPE_MAP = {
        "trigger":       build_trigger_node,
        "llm":           build_llm_node,
        "condition":     build_condition_node,
        "http_request":  build_http_node,
        "tool_call":     build_tool_call_node,
        "human_approval":build_human_approval_node,
        "parallel":      build_parallel_node,
        "output":        build_output_node,
        "code":          build_code_node,
    }

    def compile(self, definition: dict) -> StateGraph:
        graph = StateGraph(ExecutionState)

        # 1. Register each node
        for node in definition["nodes"]:
            node_fn = self.NODE_TYPE_MAP[node["type"]](node["data"])
            graph.add_node(node["id"], node_fn)

        # 2. Wire edges
        for edge in definition["edges"]:
            if edge.get("condition"):
                graph.add_conditional_edges(edge["source"],
                    self._build_router(edge), {edge["condition"]: edge["target"]})
            else:
                graph.add_edge(edge["source"], edge["target"])

        # 3. Set entry point from trigger node
        trigger = next(n for n in definition["nodes"] if n["type"] == "trigger")
        graph.set_entry_point(trigger["id"])
        graph.set_finish_point("__end__")

        return graph.compile()
```

---

## Step 5 — LangGraph Execution

The compiled graph is a Python coroutine. `execute_langgraph_activity` calls:

```python
result = await app.ainvoke(initial_state)
```

Where `initial_state` is:
```python
{
    "messages": [],
    "context": input_data,    # e.g. {"report_text": "..."}
    "memory": {},
    "output": {},
    "is_approved": False,
}
```

**What happens per node type:**
| Node type | What the compiled function does |
|-----------|--------------------------------|
| `trigger` | Passes `input_data` into state, sets `trigger_type` |
| `llm` | Calls `ChatOpenAI` / `ChatAnthropic` via LLMProviderPool, respects `temperature`, `max_tokens`, `system_prompt`, `output_format` |
| `condition` | Evaluates Jinja2 expression against state; routes to matching edge `condition` label |
| `http_request` | Makes async HTTP call (httpx), maps response fields to state via `output_mapping` |
| `tool_call` | Looks up the tool in MCPRegistry, calls the capability with `input_mapping` |
| `human_approval` | Raises `ApprovalRequired` pause — Temporal waits for signal; WebSocket pushes `approval_required` event |
| `parallel` | Spawns LangGraph parallel branches, waits for all to complete |
| `output` | Writes `output_mapping` fields to `execution.output_data` |

---

## Step 6 — Event Streaming (WebSocket)

While the graph runs, each node emits events over a **WebSocket** connection at:
`ws://backend/ws/executions/{execution_id}`

Events follow this pattern:
```json
{ "type": "node_started",    "node_id": "l1", "data": {} }
{ "type": "node_streaming",  "node_id": "l1", "data": {"chunk": "Infra"} }
{ "type": "node_completed",  "node_id": "l1", "data": {"output": {...}} }
{ "type": "cost_update",     "data": {"total_tokens": 423, "cost_usd": 0.0021} }
{ "type": "execution_completed", "data": {"output": {...}} }
```

The **Execution Monitor** UI subscribes to this WebSocket and renders each event live.

---

## Step 7 — Checkpointing

After each node completes, a checkpoint is written:
```python
# execution_extras.py
POST /executions/{id}/state/patch  # patch intermediate state
GET  /executions/{id}/checkpoints  # get per-node execution history
GET  /executions/{id}/replay       # replay events for timeline view
```

This enables:
- **Resume** from last checkpoint on failure
- **Time-travel debugging** in the UI
- **Execution CSV report** download per node

---

## How the Demo Blueprint Maps to This

`demo_blueprint.json` uses exactly these node types. When you load it in Canvas:

| Blueprint node | Compiles to... | Runtime effect |
|---------------|---------------|--------------|
| `trigger` | Pass-through that injects `report_text` | Workflow entry point |
| `classify_report` (llm) | `ChatOpenAI(gpt-4o)` with JSON output format | Calls OpenAI API, parses JSON, maps to state |
| `relevance_gate` (condition) | Jinja2: `{{ state.is_relevant == true and state.confidence_score >= 0.4 }}` | Routes to `resolve_and_analyze` or `route_elsewhere` |
| `resolve_and_analyze` (http_request) | `httpx.AsyncClient.post(INFRA_API_BASE_URL/agent/analyze)` | Calls real infra API |
| `approval_gate` (human_approval) | Temporal signal wait | Pauses graph, emits `approval_required` WebSocket event |
| `dispatch_notifications` (parallel) | LangGraph parallel branches | Runs slack/pagerduty/email simultaneously |
| `slack_notify` (tool_call) | `MCPRegistry.call("slack", "post_message", ...)` | Calls Slack MCP adapter |
| `generate_summary` (llm) | `ChatOpenAI(gpt-4o)` with text output | Generates the operational brief |
| `output` | Writes to `execution.output_data` | Stored in DB, returned to caller |

---

## Loading the Demo in the UI

```bash
# Step 1: Make sure the backend is running
# Step 2: Seed the demo blueprint
python tests/seed_demo.py --email admin@org.com --password yourpassword

# Step 3: Open the printed Canvas URL
# → http://localhost:5173/blueprints/<uuid>

# Step 4: Click "Execute" in the Canvas toolbar
# → Fill in report_text: "Power failure at Main Grid Station..."
# → Watch events stream live in the Execution Monitor
```
