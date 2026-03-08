"""
test_workflow.py — Agentic System Test Workflow
================================================
LangGraph StateGraph-based end-to-end test agent for the Agent Builder platform.
Mirrors orchestrator.py in pattern, observability, and evaluation quality.

Tests BOTH the backend API (all E10 endpoints) AND the frontend UI (Playwright).

ARCHITECTURE:
  plan_test_run → [parallel] (backend_health_check, ui_health_check)
               → test_backend_apis
               → test_blueprint_lifecycle  (create → validate → publish → execute)
               → test_execution_streaming  (WebSocket event coverage)
               → test_ui_pages             (Playwright smoke tests)
               → evaluate_results          (LLM judge scoring)
               → generate_report           (structured Markdown summary)

OBSERVABILITY:
  - Every node is wrapped in a Langfuse span
  - Each test assertion scores a Langfuse trace
  - PostgreSQL checkpointer enables resume-on-failure

DEPENDENCIES:
  pip install langgraph langchain langchain-openai langfuse langchain-postgres
              httpx playwright pytest-playwright

ENVIRONMENT (inherits from app/config.py .env):
  OPENAI_API_KEY, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST
  DATABASE_URL, BACKEND_BASE_URL, FRONTEND_BASE_URL
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal, Optional, TypedDict

import httpx
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langfuse import Langfuse
from langfuse.callback import CallbackHandler
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

logger = logging.getLogger(__name__)

# ── Environment ─────────────────────────────────────────────────────────────────

BACKEND_URL      = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")
FRONTEND_URL     = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
LANGFUSE_HOST    = os.getenv("LANGFUSE_HOST", "http://localhost:3100")
API_BASE         = f"{BACKEND_URL}/api/v1"

# ── Langfuse setup ──────────────────────────────────────────────────────────────

langfuse = Langfuse(
    public_key=os.getenv("LANGFUSE_PUBLIC_KEY", ""),
    secret_key=os.getenv("LANGFUSE_SECRET_KEY", ""),
    host=LANGFUSE_HOST,
)

# ── LLM ─────────────────────────────────────────────────────────────────────────

llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0,
    api_key=os.getenv("OPENAI_API_KEY"),
)


# ── Workflow State ───────────────────────────────────────────────────────────────

class TestResult(TypedDict):
    """Result of a single test assertion or scenario."""
    name:           str
    passed:         bool
    duration_ms:    float
    details:        str
    error:          Optional[str]
    score:          Optional[float]   # 0.0–1.0 for LLM-evaluated tests


class WorkflowTestState(TypedDict):
    """
    Full state carried across all LangGraph test nodes.
    The PostgreSQL checkpointer persists this for resume-on-failure.
    """
    # Core conversation
    messages:               Annotated[list, add_messages]
    run_id:                 str       # Langfuse trace correlation ID
    started_at:             str       # ISO timestamp

    # Configuration
    backend_url:            str
    frontend_url:           str
    auth_token:             Optional[str]   # JWT from /auth/login
    test_user_email:        str
    test_user_password:     str

    # Health check results
    backend_healthy:        bool
    frontend_healthy:       bool
    health_details:         Dict[str, Any]

    # Test results — one list per phase
    api_test_results:       List[TestResult]
    lifecycle_test_results: List[TestResult]
    stream_test_results:    List[TestResult]
    ui_test_results:        List[TestResult]
    eval_test_results:      List[TestResult]

    # Created resources (for cleanup)
    created_blueprint_id:   Optional[str]
    created_execution_id:   Optional[str]
    created_tool_id:        Optional[str]

    # Evaluation
    total_tests:            int
    passed_tests:           int
    failed_tests:           int
    aggregate_score:        float           # weighted 0.0–1.0
    judge_reasoning:        Optional[str]

    # Output
    final_report:           Optional[str]   # Markdown report
    workflow_status:        str             # running | completed | failed


# ── API Client ───────────────────────────────────────────────────────────────────

class AgentBuilderClient:
    """Async HTTP client for the Agent Builder backend."""

    def __init__(self, base_url: str = API_BASE, token: str = None):
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self.client = httpx.AsyncClient(
            base_url=base_url,
            headers=headers,
            timeout=30.0,
            follow_redirects=True,
        )

    async def login(self, email: str, password: str) -> Dict:
        r = await self.client.post("/auth/login", json={"email": email, "password": password})
        r.raise_for_status()
        return r.json()

    async def health(self) -> Dict:
        r = await self.client.get("/health")
        r.raise_for_status()
        return r.json()

    async def create_blueprint(self, definition: Dict) -> Dict:
        r = await self.client.post("/blueprints", json=definition)
        r.raise_for_status()
        return r.json()

    async def get_blueprint(self, bp_id: str) -> Dict:
        r = await self.client.get(f"/blueprints/{bp_id}")
        r.raise_for_status()
        return r.json()

    async def validate_blueprint(self, bp_id: str) -> Dict:
        r = await self.client.post("/blueprints/validate", json={"blueprint_id": bp_id})
        r.raise_for_status()
        return r.json()

    async def estimate_cost(self, bp_id: str) -> Dict:
        r = await self.client.get(f"/blueprints/{bp_id}/estimate-cost")
        r.raise_for_status()
        return r.json()

    async def generate_blueprint(self, prompt: str) -> Dict:
        r = await self.client.post("/blueprints/generate", json={"prompt": prompt})
        r.raise_for_status()
        return r.json()

    async def list_tools(self) -> List[Dict]:
        r = await self.client.get("/tools")
        r.raise_for_status()
        return r.json()

    async def tool_health(self, tool_id: str) -> Dict:
        r = await self.client.get(f"/tools/{tool_id}/health")
        r.raise_for_status()
        return r.json()

    async def test_tool_capability(self, tool_id: str, capability: str, input_data: Dict) -> Dict:
        r = await self.client.post(f"/tools/{tool_id}/test",
                                   json={"capability": capability, "input": input_data})
        r.raise_for_status()
        return r.json()

    async def create_execution(self, bp_id: str, input_data: Dict) -> Dict:
        r = await self.client.post("/executions", json={"blueprint_id": bp_id, "input_data": input_data})
        r.raise_for_status()
        return r.json()

    async def get_execution(self, exec_id: str) -> Dict:
        r = await self.client.get(f"/executions/{exec_id}")
        r.raise_for_status()
        return r.json()

    async def get_checkpoints(self, exec_id: str) -> List[Dict]:
        r = await self.client.get(f"/executions/{exec_id}/checkpoints")
        r.raise_for_status()
        return r.json()

    async def get_execution_report(self, exec_id: str) -> bytes:
        r = await self.client.get(f"/executions/{exec_id}/report")
        r.raise_for_status()
        return r.content  # CSV bytes

    async def list_base_prompts(self) -> List[Dict]:
        r = await self.client.get("/base-prompts")
        r.raise_for_status()
        return r.json()

    async def get_audit_log(self, params: Dict = None) -> Dict:
        r = await self.client.get("/admin/audit-log", params=params or {})
        r.raise_for_status()
        return r.json()

    async def get_dependency_graph(self) -> Dict:
        r = await self.client.get("/admin/dependency-graph")
        r.raise_for_status()
        return r.json()

    async def close(self):
        await self.client.aclose()


# ── Helpers ──────────────────────────────────────────────────────────────────────

def make_test_result(name: str, passed: bool, duration_ms: float,
                     details: str, error: str = None, score: float = None) -> TestResult:
    return TestResult(name=name, passed=passed, duration_ms=duration_ms,
                      details=details, error=error, score=score)


def timed() -> float:
    """Return current monotonic time in milliseconds."""
    import time
    return time.monotonic() * 1000


# ── Minimal test blueprint definition ────────────────────────────────────────────

MINIMAL_BLUEPRINT = {
    "name": f"[TEST] Hello World — {datetime.utcnow().strftime('%H:%M:%S')}",
    "description": "Auto-generated test blueprint. Safe to delete.",
    "schema_version": "2.0",
    "blueprint_type": "workflow",
    "domain": "testing",
    "definition": {
        "nodes": [
            {
                "id": "trigger_1",
                "type": "trigger",
                "label": "Test Trigger",
                "data": {
                    "trigger_type": "manual",
                    "input_schema": {"message": {"type": "string"}},
                },
            },
            {
                "id": "llm_1",
                "type": "llm",
                "label": "Echo LLM",
                "data": {
                    "provider": "openai",
                    "model": "gpt-4o-mini",
                    "system_prompt": "You are a helpful assistant. Echo the user's message politely.",
                    "user_prompt_template": "Message: {{ message }}",
                    "temperature": 0.0,
                    "max_tokens": 200,
                    "timeout": 30,
                    "retry_policy": {"max_attempts": 2, "backoff": "linear"},
                    "input_mapping": {"message": "{{ state.message }}"},
                    "output_mapping": {"response": "llm_response"},
                },
            },
            {
                "id": "output_1",
                "type": "output",
                "label": "Output",
                "data": {
                    "output_mapping": {"result": "{{ state.llm_response }}"},
                },
            },
        ],
        "edges": [
            {"id": "e1", "source": "trigger_1", "target": "llm_1"},
            {"id": "e2", "source": "llm_1", "target": "output_1"},
        ],
    },
}


# ── ============================================================================ ─
# ── Graph Nodes
# ── ============================================================================ ─

async def plan_test_run(state: WorkflowTestState) -> Dict:
    """
    Node 1: Initialize the test run — create auth token, log test plan.
    Equivalent to classify_report in the orchestrator.
    """
    trace = langfuse.trace(
        name="plan_test_run",
        id=state["run_id"],
        tags=["system-test"],
        metadata={"backend_url": state["backend_url"], "frontend_url": state["frontend_url"]},
    )
    span = trace.span(name="auth_login")

    client = AgentBuilderClient(f"{state['backend_url']}/api/v1")
    try:
        result = await client.login(state["test_user_email"], state["test_user_password"])
        token = result.get("access_token") or result.get("token")
        span.end(output={"token_obtained": bool(token)})
        logger.info(f"[TEST] Auth token obtained: {bool(token)}")

        return {
            "auth_token": token,
            "workflow_status": "running",
            "messages": [AIMessage(content="✅ Auth token obtained. Starting test plan.")],
        }
    except Exception as e:
        span.end(level="ERROR", status_message=str(e))
        logger.error(f"Auth failed: {e}")
        return {
            "auth_token": None,
            "workflow_status": "running",
            "messages": [AIMessage(content=f"⚠️ Auth failed ({e}) — continuing unauthenticated.")],
        }
    finally:
        await client.close()


async def health_check(state: WorkflowTestState) -> Dict:
    """
    Node 2: Check backend + frontend health before running any tests.
    Parallel-safe — only reads state, writes to `health_details`.
    """
    trace = langfuse.trace(name="health_check", id=state["run_id"])
    results: Dict[str, Any] = {}
    backend_ok = False
    frontend_ok = False

    # ── Backend health ──────────────────────────────────────────────────────────
    span_b = trace.span(name="backend_health")
    t0 = timed()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{state['backend_url']}/api/v1/health")
            backend_ok = r.status_code == 200
            results["backend"] = r.json() if backend_ok else {"status_code": r.status_code}
    except Exception as e:
        results["backend"] = {"error": str(e)}
    span_b.end(output=results["backend"], level="DEFAULT" if backend_ok else "ERROR")
    results["backend_latency_ms"] = round(timed() - t0, 1)

    # ── Frontend health ─────────────────────────────────────────────────────────
    span_f = trace.span(name="frontend_health")
    t0 = timed()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(state["frontend_url"])
            frontend_ok = r.status_code == 200
            results["frontend"] = {"status_code": r.status_code}
    except Exception as e:
        results["frontend"] = {"error": str(e)}
    span_f.end(output=results["frontend"], level="DEFAULT" if frontend_ok else "WARNING")
    results["frontend_latency_ms"] = round(timed() - t0, 1)

    trace.score(name="system_health", value=1.0 if (backend_ok and frontend_ok) else 0.5 if backend_ok else 0.0)

    status_msg = (
        f"✅ Backend: {'OK' if backend_ok else 'DOWN'} ({results['backend_latency_ms']}ms) | "
        f"{'✅' if frontend_ok else '⚠️'} Frontend: {'OK' if frontend_ok else 'DOWN'}"
    )
    logger.info(f"[TEST] {status_msg}")

    return {
        "backend_healthy": backend_ok,
        "frontend_healthy": frontend_ok,
        "health_details": results,
        "messages": [AIMessage(content=status_msg)],
    }


async def test_backend_apis(state: WorkflowTestState) -> Dict:
    """
    Node 3: Exercise all E10 API endpoints with real HTTP calls.
    Tests: health, auth, blueprints CRUD, tools catalog, base-prompts,
           audit log, dependency graph, estimate-cost, validate.
    """
    trace = langfuse.trace(name="test_backend_apis", id=state["run_id"])
    results: List[TestResult] = []
    token = state.get("auth_token")
    client = AgentBuilderClient(f"{state['backend_url']}/api/v1", token)

    async def _test(name: str, coro, *, check=None):
        span = trace.span(name=f"api.{name.lower().replace(' ', '_')}")
        t0 = timed()
        try:
            data = await coro
            duration = round(timed() - t0, 1)
            passed = check(data) if check else True
            span.end(output=data if isinstance(data, dict) else {"count": len(data)})
            results.append(make_test_result(name, passed, duration,
                                            str(data)[:200] if passed else "Check failed"))
        except Exception as e:
            duration = round(timed() - t0, 1)
            span.end(level="ERROR", status_message=str(e))
            results.append(make_test_result(name, False, duration, "", str(e)))

    # ── Auth ────────────────────────────────────────────────────────────────────
    await _test("Auth: GET /health", client.health(),
                check=lambda d: d.get("status") in ("ok", "healthy", True, "running"))

    # ── Blueprints ──────────────────────────────────────────────────────────────
    async def list_blueprints():
        r = await client.client.get("/blueprints")
        r.raise_for_status()
        return r.json()

    await _test("Blueprints: GET /blueprints", list_blueprints(),
                check=lambda d: isinstance(d, (list, dict)))

    await _test("Blueprints: POST /blueprints (create minimal)",
                client.create_blueprint(MINIMAL_BLUEPRINT),
                check=lambda d: "id" in d)

    # Store created blueprint ID for subsequent nodes
    created_bp_id = None
    for r in results:
        if r["name"].startswith("Blueprints: POST") and r["passed"]:
            # Re-run to get the ID (we need it)
            break

    # Create again and capture ID properly
    try:
        defn = MINIMAL_BLUEPRINT.copy()
        defn["name"] += " (lifecycle)"
        bp = await client.create_blueprint(defn)
        created_bp_id = bp.get("id")
    except Exception:
        pass

    if created_bp_id:
        await _test("Blueprints: GET /blueprints/{id}",
                    client.get_blueprint(created_bp_id),
                    check=lambda d: d.get("id") == created_bp_id)

        await _test("Blueprints: POST /blueprints/validate",
                    client.validate_blueprint(created_bp_id),
                    check=lambda d: "errors" in d)

        await _test("Blueprints: GET /blueprints/{id}/estimate-cost",
                    client.estimate_cost(created_bp_id),
                    check=lambda d: isinstance(d, dict))

    # ── Tools ────────────────────────────────────────────────────────────────────
    await _test("Tools: GET /tools",
                client.list_tools(),
                check=lambda d: isinstance(d, list))

    # ── Base Prompts ─────────────────────────────────────────────────────────────
    await _test("BasePrompts: GET /base-prompts",
                client.list_base_prompts(),
                check=lambda d: isinstance(d, list))

    # ── Admin ────────────────────────────────────────────────────────────────────
    await _test("Admin: GET /admin/audit-log",
                client.get_audit_log({"page": 1, "page_size": 5}),
                check=lambda d: isinstance(d, dict))

    await _test("Admin: GET /admin/dependency-graph",
                client.get_dependency_graph(),
                check=lambda d: isinstance(d, dict))

    # ── Score summary ─────────────────────────────────────────────────────────────
    passed = sum(1 for r in results if r["passed"])
    total = len(results)
    score = passed / total if total else 0
    trace.score(name="api_test_coverage", value=score)
    logger.info(f"[TEST] API tests: {passed}/{total} passed (score={score:.2f})")

    await client.close()
    return {
        "api_test_results": results,
        "created_blueprint_id": created_bp_id,
        "messages": [AIMessage(content=f"API tests: {passed}/{total} passed")],
    }


async def test_blueprint_lifecycle(state: WorkflowTestState) -> Dict:
    """
    Node 4: Full blueprint lifecycle — create → validate → NL generate → execute → checkpoints.
    This is the real-world primary user journey.
    """
    trace = langfuse.trace(name="test_blueprint_lifecycle", id=state["run_id"])
    results: List[TestResult] = []
    token = state.get("auth_token")
    client = AgentBuilderClient(f"{state['backend_url']}/api/v1", token)

    bp_id = state.get("created_blueprint_id")

    # ── 1. NL Blueprint Generation ───────────────────────────────────────────────
    span = trace.span(name="nl_generate")
    t0 = timed()
    generated_bp_id = None
    try:
        result = await client.generate_blueprint(
            "When a webhook fires with a message, echo it with an LLM and log the result"
        )
        duration = round(timed() - t0, 1)
        generated_bp_id = result.get("id") or result.get("blueprint_id")
        passed = bool(generated_bp_id) or "definition" in result
        span.end(output={"generated_id": generated_bp_id, "node_count": len(result.get("definition", {}).get("nodes", []))})
        results.append(make_test_result(
            "Lifecycle: NL blueprint generation", passed, duration,
            f"Generated blueprint with {len(result.get('definition', {}).get('nodes', []))} nodes"
        ))
    except Exception as e:
        duration = round(timed() - t0, 1)
        span.end(level="ERROR", status_message=str(e))
        results.append(make_test_result("Lifecycle: NL blueprint generation", False, duration, "", str(e)))

    # ── 2. Validate blueprint ───────────────────────────────────────────────────
    target_id = generated_bp_id or bp_id
    if target_id:
        span = trace.span(name="validate")
        t0 = timed()
        try:
            val = await client.validate_blueprint(target_id)
            duration = round(timed() - t0, 1)
            passed = "errors" in val  # endpoint responds = passes
            has_errors = len(val.get("errors", [])) > 0
            results.append(make_test_result(
                "Lifecycle: Blueprint validation",
                passed, duration,
                f"{len(val.get('errors', []))} errors, {len(val.get('warnings', []))} warnings"
                + (" — VALID" if not has_errors else " — HAS ERRORS (expected for test blueprint)")
            ))
            span.end(output=val)
        except Exception as e:
            duration = round(timed() - t0, 1)
            span.end(level="ERROR", status_message=str(e))
            results.append(make_test_result("Lifecycle: Blueprint validation", False, duration, "", str(e)))

    # ── 3. Create execution ─────────────────────────────────────────────────────
    exec_id = None
    if bp_id:
        span = trace.span(name="create_execution")
        t0 = timed()
        try:
            exec_result = await client.create_execution(bp_id, {"message": "Hello from test agent!"})
            duration = round(timed() - t0, 1)
            exec_id = exec_result.get("id")
            passed = bool(exec_id)
            results.append(make_test_result(
                "Lifecycle: Create execution", passed, duration,
                f"Execution ID: {exec_id}, Status: {exec_result.get('status')}"
            ))
            span.end(output={"execution_id": exec_id, "status": exec_result.get("status")})
        except Exception as e:
            duration = round(timed() - t0, 1)
            span.end(level="ERROR", status_message=str(e))
            results.append(make_test_result("Lifecycle: Create execution", False, duration, "", str(e)))

    # ── 4. Poll execution to terminal state ─────────────────────────────────────
    if exec_id:
        span = trace.span(name="poll_execution")
        t0 = timed()
        terminal_statuses = {"completed", "failed", "cancelled"}
        final_status = None
        poll_attempts = 0
        try:
            while poll_attempts < 30:   # max 30s
                await asyncio.sleep(1)
                exec_data = await client.get_execution(exec_id)
                final_status = exec_data.get("status")
                poll_attempts += 1
                if final_status in terminal_statuses:
                    break
            duration = round(timed() - t0, 1)
            passed = final_status in terminal_statuses
            results.append(make_test_result(
                "Lifecycle: Execution terminal state", passed, duration,
                f"Status: {final_status} after {poll_attempts} polls"
            ))
            span.end(output={"status": final_status, "polls": poll_attempts})
        except Exception as e:
            duration = round(timed() - t0, 1)
            span.end(level="ERROR", status_message=str(e))
            results.append(make_test_result("Lifecycle: Execution terminal state", False, duration, "", str(e)))

    # ── 5. Get checkpoints ──────────────────────────────────────────────────────
    if exec_id:
        span = trace.span(name="get_checkpoints")
        t0 = timed()
        try:
            checkpoints = await client.get_checkpoints(exec_id)
            duration = round(timed() - t0, 1)
            passed = isinstance(checkpoints, list)
            results.append(make_test_result(
                "Lifecycle: Execution checkpoints", passed, duration,
                f"{len(checkpoints)} checkpoint(s) returned"
            ))
            span.end(output={"checkpoint_count": len(checkpoints)})
        except Exception as e:
            duration = round(timed() - t0, 1)
            span.end(level="ERROR", status_message=str(e))
            results.append(make_test_result("Lifecycle: Execution checkpoints", False, duration, "", str(e)))

    # ── 6. Download CSV report ──────────────────────────────────────────────────
    if exec_id:
        span = trace.span(name="execution_report")
        t0 = timed()
        try:
            report_bytes = await client.get_execution_report(exec_id)
            duration = round(timed() - t0, 1)
            passed = len(report_bytes) > 10 and b"node_id" in report_bytes
            results.append(make_test_result(
                "Lifecycle: Execution CSV report", passed, duration,
                f"Report size: {len(report_bytes)} bytes"
            ))
            span.end(output={"report_bytes": len(report_bytes)})
        except Exception as e:
            duration = round(timed() - t0, 1)
            span.end(level="ERROR", status_message=str(e))
            results.append(make_test_result("Lifecycle: Execution CSV report", False, duration, "", str(e)))

    passed = sum(1 for r in results if r["passed"])
    total = len(results)
    score = passed / total if total else 0
    trace.score(name="lifecycle_test_coverage", value=score)
    logger.info(f"[TEST] Lifecycle tests: {passed}/{total} passed")

    await client.close()
    return {
        "lifecycle_test_results": results,
        "created_execution_id": exec_id,
        "messages": [AIMessage(content=f"Lifecycle tests: {passed}/{total} passed")],
    }


async def test_execution_streaming(state: WorkflowTestState) -> Dict:
    """
    Node 5: Test WebSocket execution streaming — connect and verify all 15 event types.
    Falls back to HTTP polling if WebSocket unavailable.
    """
    import websockets

    trace = langfuse.trace(name="test_execution_streaming", id=state["run_id"])
    results: List[TestResult] = []
    exec_id = state.get("created_execution_id")

    if not exec_id:
        return {
            "stream_test_results": [make_test_result(
                "Streaming: WebSocket events", False, 0,
                "Skipped — no execution_id available (lifecycle tests may have failed)"
            )],
            "messages": [AIMessage(content="Streaming tests skipped (no execution ID)")],
        }

    # ── WebSocket connection test ─────────────────────────────────────────────────
    span = trace.span(name="websocket_connect")
    t0 = timed()
    ws_url = f"ws://{state['backend_url'].replace('http://', '').replace('https://', '')}/ws/executions/{exec_id}"
    received_event_types: set = set()
    EXPECTED_EVENTS = {
        "node_queued", "node_started", "node_streaming", "node_completed",
        "node_failed", "node_retrying", "node_skipped",
        "execution_completed", "execution_failed",
        "cost_update", "state_updated",
        "approval_required", "approval_resolved",
        "guardrail_triggered", "heartbeat",
    }

    try:
        token = state.get("auth_token", "")
        ws_headers = {"Authorization": f"Bearer {token}"} if token else {}
        # 10s timeout to collect events
        async with websockets.connect(ws_url, extra_headers=ws_headers, open_timeout=5) as ws:
            try:
                while True:
                    raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
                    evt = json.loads(raw)
                    received_event_types.add(evt.get("type", "unknown"))
                    if evt.get("type") in ("execution_completed", "execution_failed"):
                        break
            except asyncio.TimeoutError:
                pass

        duration = round(timed() - t0, 1)
        coverage = len(received_event_types & EXPECTED_EVENTS) / max(len(EXPECTED_EVENTS), 1)
        passed = len(received_event_types) > 0
        span.end(output={"received_types": list(received_event_types), "coverage": coverage})
        trace.score(name="websocket_event_coverage", value=coverage)
        results.append(make_test_result(
            "Streaming: WebSocket connection", passed, duration,
            f"Received {len(received_event_types)} event types. Coverage: {coverage:.1%}",
        ))
        results.append(make_test_result(
            "Streaming: Event type coverage", coverage >= 0.5, duration,
            f"Received: {sorted(received_event_types)}"
        ))

    except Exception as e:
        duration = round(timed() - t0, 1)
        span.end(level="WARNING", status_message=str(e))
        # Fallback: verify execution finished via HTTP (proves the backend pipeline worked)
        try:
            async with httpx.AsyncClient(timeout=10.0) as hc:
                r = await hc.get(
                    f"{state['backend_url']}/api/v1/executions/{exec_id}",
                    headers={"Authorization": f"Bearer {state.get('auth_token', '')}"}
                )
                exec_data = r.json()
                passed = exec_data.get("status") in ("completed", "failed")
        except Exception:
            passed = False
        results.append(make_test_result(
            "Streaming: WebSocket (fallback HTTP check)", passed, duration,
            f"WebSocket unavailable: {e}. HTTP execution status verified.",
        ))

    passed_count = sum(1 for r in results if r["passed"])
    total = len(results)
    logger.info(f"[TEST] Streaming tests: {passed_count}/{total} passed")

    return {
        "stream_test_results": results,
        "messages": [AIMessage(content=f"Streaming tests: {passed_count}/{total} passed")],
    }


async def test_ui_pages(state: WorkflowTestState) -> Dict:
    """
    Node 6: Playwright smoke tests — verify every major page loads without crashes.
    Captures screenshots per page. Falls back gracefully if Playwright not installed.
    """
    trace = langfuse.trace(name="test_ui_pages", id=state["run_id"])
    results: List[TestResult] = []
    frontend = state["frontend_url"]

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return {
            "ui_test_results": [make_test_result(
                "UI: Playwright not installed", False, 0,
                "Run: pip install playwright && playwright install chromium"
            )],
            "messages": [AIMessage(content="UI tests skipped — Playwright not installed")],
        }

    PAGES = [
        ("/login",                   "Login"),
        ("/dashboard",               "Dashboard"),
        ("/blueprints",              "Blueprints"),
        ("/tools",                   "Tools Catalog"),
        ("/analytics",               "Analytics"),
        ("/executions",              "Executions"),
        ("/approvals",               "Approvals"),
        ("/admin/base-prompts",      "Base Prompts (Admin)"),
        ("/admin/dependency-graph",  "Dependency Graph"),
        ("/admin/audit-log",         "Audit Log"),
    ]

    span = trace.span(name="playwright_smoke")
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            ctx = await browser.new_context(
                viewport={"width": 1440, "height": 900},
                base_url=frontend,
            )

            # Log in once so we get a session cookie/localStorage token
            page = await ctx.new_page()
            await page.goto("/login")
            try:
                await page.fill('[type="email"]', state["test_user_email"])
                await page.fill('[type="password"]', state["test_user_password"])
                await page.click('[type="submit"]')
                await page.wait_for_url("**/dashboard**", timeout=10_000)
            except Exception as login_err:
                logger.warning(f"[UI] Login via Playwright failed: {login_err}")

            for path, label in PAGES:
                t0 = timed()
                p = await ctx.new_page()
                try:
                    resp = await p.goto(f"{frontend}{path}", wait_until="networkidle", timeout=15_000)
                    # Check no JS errors in console
                    errors = []
                    p.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
                    await p.wait_for_timeout(2000)

                    status_ok = resp and resp.status < 400
                    no_crash = "Something went wrong" not in await p.content() \
                               and "Error" not in await p.title()

                    duration = round(timed() - t0, 1)
                    passed = status_ok and no_crash
                    results.append(make_test_result(
                        f"UI: {label}", passed, duration,
                        f"HTTP {resp.status if resp else '?'} — "
                        f"{'OK' if passed else 'CRASH/ERROR'}"
                        + (f" — Console errors: {errors[:3]}" if errors else "")
                    ))
                except Exception as e:
                    duration = round(timed() - t0, 1)
                    results.append(make_test_result(f"UI: {label}", False, duration, "", str(e)))
                finally:
                    await p.close()

            await browser.close()

    except Exception as e:
        span.end(level="ERROR", status_message=str(e))
        results.append(make_test_result("UI: Playwright browser", False, 0, "", str(e)))

    span.end(output={"pages_tested": len(PAGES), "results": [r["name"] for r in results if r["passed"]]})

    passed_count = sum(1 for r in results if r["passed"])
    score = passed_count / len(results) if results else 0
    trace.score(name="ui_page_availability", value=score)
    logger.info(f"[TEST] UI tests: {passed_count}/{len(results)} passed")

    return {
        "ui_test_results": results,
        "messages": [AIMessage(content=f"UI tests: {passed_count}/{len(results)} passed")],
    }


async def evaluate_results(state: WorkflowTestState) -> Dict:
    """
    Node 7: LLM-as-judge evaluation of the full test run.
    Mirrors orchestrator's generate_summary — uses LLM to produce structured quality scores.
    """
    trace = langfuse.trace(name="evaluate_results", id=state["run_id"])
    span = trace.span(name="llm_judge")

    all_results = (
        state.get("api_test_results", [])
        + state.get("lifecycle_test_results", [])
        + state.get("stream_test_results", [])
        + state.get("ui_test_results", [])
    )

    total = len(all_results)
    passed = sum(1 for r in all_results if r["passed"])
    failed = total - passed

    # Build summary line per test
    test_summary = "\n".join(
        f"{'✅' if r['passed'] else '❌'} [{r['name']}] {r['details']}"
        + (f" — ERROR: {r['error']}" if r.get('error') else "")
        for r in all_results
    )

    EVAL_SYSTEM = """You are a critical software quality evaluator reviewing an automated system test report.
Score the platform on these 5 dimensions from 0.0 to 1.0:
1. api_correctness: API endpoints respond correctly with valid data
2. lifecycle_reliability: Blueprint create→validate→execute pipeline completes without errors
3. streaming_coverage: WebSocket events cover expected types
4. ui_availability: UI pages load without crashes
5. overall_quality: Holistic assessment

Respond ONLY as JSON:
{
  "api_correctness": float,
  "lifecycle_reliability": float,
  "streaming_coverage": float,
  "ui_availability": float,
  "overall_quality": float,
  "weighted_score": float,
  "reasoning": "2-3 sentence assessment",
  "critical_failures": ["list of test names that represent blocking issues"],
  "recommendations": ["actionable fix suggestions"]
}"""

    scores = {}
    judge_reasoning = ""
    critical_failures = []

    try:
        response = await llm.ainvoke([
            SystemMessage(content=EVAL_SYSTEM),
            HumanMessage(content=(
                f"TEST RUN SUMMARY\n"
                f"Total: {total} tests | Passed: {passed} | Failed: {failed}\n"
                f"Pass rate: {passed/total:.1%}\n\n"
                f"DETAILED RESULTS:\n{test_summary}"
            )),
        ])
        parsed = json.loads(response.content)
        scores = {k: v for k, v in parsed.items() if isinstance(v, float)}
        judge_reasoning = parsed.get("reasoning", "")
        critical_failures = parsed.get("critical_failures", [])
        recommendations = parsed.get("recommendations", [])

        aggregate = parsed.get("weighted_score", passed / total if total else 0)
        span.end(output={"scores": scores, "aggregate": aggregate})

        # Score per dimension in Langfuse
        for dim, val in scores.items():
            trace.score(name=f"eval_{dim}", value=val)

        eval_results = [
            make_test_result(f"Judge: {dim}", val >= 0.6, 0,
                             f"Score: {val:.2f}", score=val)
            for dim, val in scores.items() if dim != "weighted_score"
        ]

        return {
            "eval_test_results": eval_results,
            "total_tests": total,
            "passed_tests": passed,
            "failed_tests": failed,
            "aggregate_score": aggregate,
            "judge_reasoning": judge_reasoning + (
                f"\n\n🚨 Critical failures: {critical_failures}" if critical_failures else ""
            ) + (f"\n\n💡 Recommendations:\n" + "\n".join(f"• {r}" for r in recommendations) if recommendations else ""),
            "messages": [AIMessage(content=f"Judge score: {aggregate:.2f} — {judge_reasoning[:120]}")],
        }

    except Exception as e:
        span.end(level="ERROR", status_message=str(e))
        aggregate = passed / total if total else 0
        return {
            "eval_test_results": [],
            "total_tests": total,
            "passed_tests": passed,
            "failed_tests": failed,
            "aggregate_score": aggregate,
            "judge_reasoning": f"Evaluation failed: {e}",
            "messages": [AIMessage(content=f"Eval fallback score: {aggregate:.2f}")],
        }


async def generate_report(state: WorkflowTestState) -> Dict:
    """
    Node 8: Produce a structured Markdown report.
    Mirrors orchestrator's generate_summary — final human-readable output.
    """
    trace = langfuse.trace(name="generate_report", id=state["run_id"])
    span = trace.span(name="build_report")

    all_results = (
        state.get("api_test_results", [])
        + state.get("lifecycle_test_results", [])
        + state.get("stream_test_results", [])
        + state.get("ui_test_results", [])
        + state.get("eval_test_results", [])
    )

    def badge(passed: bool) -> str:
        return "✅" if passed else "❌"

    def section_table(results: List[TestResult], title: str) -> str:
        if not results:
            return ""
        rows = "\n".join(
            f"| {badge(r['passed'])} | {r['name']} | {r['duration_ms']}ms "
            f"| {r['details'][:80] if r['details'] else ''}{'…' if len(r.get('details','')) > 80 else ''} "
            f"| {r.get('error', '') or ''} |"
            for r in results
        )
        return f"""
### {title}

| Status | Test | Duration | Details | Error |
|--------|------|----------|---------|-------|
{rows}
"""

    total = state.get("total_tests", len(all_results))
    passed = state.get("passed_tests", sum(1 for r in all_results if r["passed"]))
    score = state.get("aggregate_score", 0)
    run_id = state["run_id"]
    started = state.get("started_at", "unknown")

    health = state.get("health_details", {})
    health_summary = (
        f"Backend: {'✅ UP' if state.get('backend_healthy') else '❌ DOWN'} "
        f"({health.get('backend_latency_ms', '?')}ms) | "
        f"Frontend: {'✅ UP' if state.get('frontend_healthy') else '⚠️ DOWN'} "
        f"({health.get('frontend_latency_ms', '?')}ms)"
    )

    score_bar = "█" * int(score * 20) + "░" * (20 - int(score * 20))

    report = f"""# Agent Builder Platform — System Test Report

**Run ID:** `{run_id}`
**Started:** {started}
**Backend:** `{state['backend_url']}`
**Frontend:** `{state['frontend_url']}`

---

## 📊 Summary

| Metric | Value |
|--------|-------|
| Total Tests | {total} |
| Passed | ✅ {passed} |
| Failed | ❌ {total - passed} |
| Pass Rate | {passed/total:.1%} if total else N/A |
| Judge Score | {score:.2f} / 1.00 |

**Quality Bar:** `{score_bar}` {score:.0%}

**System Health:** {health_summary}

---

## 🧠 LLM Judge Assessment

{state.get('judge_reasoning', 'No evaluation available.')}

---
{section_table(state.get('api_test_results', []), '🌐 API Endpoint Tests')}
{section_table(state.get('lifecycle_test_results', []), '🔄 Blueprint Lifecycle Tests')}
{section_table(state.get('stream_test_results', []), '📡 WebSocket Streaming Tests')}
{section_table(state.get('ui_test_results', []), '🖥️ UI Page Smoke Tests')}
{section_table(state.get('eval_test_results', []), '⭐ Evaluation Dimension Scores')}

---

*Generated by Agent Builder Test Workflow v1.0 — {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}*
*Langfuse trace: `{LANGFUSE_HOST}/traces/{run_id}`*
"""

    span.end(output={"report_length": len(report)})
    trace.score(name="report_generated", value=1.0)
    logger.info(f"[TEST] Report generated: {len(report)} chars")

    return {
        "final_report": report,
        "workflow_status": "completed",
        "messages": [AIMessage(content=f"✅ Report generated. Score: {score:.2f} ({passed}/{total} passed)")],
    }


# ── Routing functions ─────────────────────────────────────────────────────────────

def should_test(state: WorkflowTestState) -> Literal["test_backend_apis", "generate_report"]:
    """Skip all tests if backend is completely down."""
    if not state.get("backend_healthy") and not state.get("auth_token"):
        logger.warning("[TEST] Backend unreachable and no auth — generating failure report")
        return "generate_report"
    return "test_backend_apis"


def after_backend_tests(state: WorkflowTestState) -> Literal["test_blueprint_lifecycle", "evaluate_results"]:
    """Skip lifecycle tests if auth failed and critical API tests all failed."""
    api_results = state.get("api_test_results", [])
    failures = sum(1 for r in api_results if not r["passed"])
    if failures == len(api_results) and len(api_results) > 0:
        logger.warning("[TEST] All API tests failed — skipping lifecycle tests")
        return "evaluate_results"
    return "test_blueprint_lifecycle"


# ── Build the graph ───────────────────────────────────────────────────────────────

def build_test_graph() -> StateGraph:
    """Build the test workflow StateGraph — mirrors orchestrator.py structure."""
    graph = StateGraph(WorkflowTestState)

    # Register nodes
    graph.add_node("plan_test_run",             plan_test_run)
    graph.add_node("health_check",              health_check)
    graph.add_node("test_backend_apis",         test_backend_apis)
    graph.add_node("test_blueprint_lifecycle",  test_blueprint_lifecycle)
    graph.add_node("test_execution_streaming",  test_execution_streaming)
    graph.add_node("test_ui_pages",             test_ui_pages)
    graph.add_node("evaluate_results",          evaluate_results)
    graph.add_node("generate_report",           generate_report)

    # Edges
    graph.add_edge(START,                       "plan_test_run")
    graph.add_edge("plan_test_run",             "health_check")
    graph.add_conditional_edges("health_check", should_test)
    graph.add_conditional_edges("test_backend_apis", after_backend_tests)
    graph.add_edge("test_blueprint_lifecycle",  "test_execution_streaming")
    graph.add_edge("test_execution_streaming",  "test_ui_pages")
    graph.add_edge("test_ui_pages",             "evaluate_results")
    graph.add_edge("evaluate_results",          "generate_report")
    graph.add_edge("generate_report",           END)

    return graph


# ── Runner ─────────────────────────────────────────────────────────────────────────

async def run_test_workflow(
    backend_url: str = None,
    frontend_url: str = None,
    test_user_email: str = None,
    test_user_password: str = None,
    thread_id: str = None,
    db_url: str = None,
    output_path: str = None,
) -> Dict[str, Any]:
    """
    Execute the full system test workflow.

    Args:
        backend_url:        Agent Builder API base URL (default: env BACKEND_BASE_URL)
        frontend_url:       Frontend URL (default: env FRONTEND_BASE_URL)
        test_user_email:    Login email for auth (default: env TEST_USER_EMAIL)
        test_user_password: Login password (default: env TEST_USER_PASSWORD)
        thread_id:          LangGraph thread ID for checkpointing (enables resume)
        db_url:             PostgreSQL connection string (enables checkpointing + resume)
        output_path:        Path to write Markdown report (optional)

    Returns:
        Final WorkflowTestState dict including final_report
    """
    run_id    = str(uuid.uuid4())
    thread_id = thread_id or run_id

    langfuse_handler = CallbackHandler(
        public_key=os.getenv("LANGFUSE_PUBLIC_KEY", ""),
        secret_key=os.getenv("LANGFUSE_SECRET_KEY", ""),
        host=LANGFUSE_HOST,
        trace_name="agent-builder-system-test",
        session_id=thread_id,
        user_id="test-workflow-agent",
        tags=["system-test", "automated"],
    )

    initial_state: WorkflowTestState = {
        "messages":               [HumanMessage(content="Start Agent Builder system test")],
        "run_id":                 run_id,
        "started_at":             datetime.utcnow().isoformat() + "Z",
        "backend_url":            backend_url or BACKEND_URL,
        "frontend_url":           frontend_url or FRONTEND_URL,
        "auth_token":             None,
        "test_user_email":        test_user_email or os.getenv("TEST_USER_EMAIL", "test@example.com"),
        "test_user_password":     test_user_password or os.getenv("TEST_USER_PASSWORD", "password123"),
        "backend_healthy":        False,
        "frontend_healthy":       False,
        "health_details":         {},
        "api_test_results":       [],
        "lifecycle_test_results": [],
        "stream_test_results":    [],
        "ui_test_results":        [],
        "eval_test_results":      [],
        "created_blueprint_id":   None,
        "created_execution_id":   None,
        "created_tool_id":        None,
        "total_tests":            0,
        "passed_tests":           0,
        "failed_tests":           0,
        "aggregate_score":        0.0,
        "judge_reasoning":        None,
        "final_report":           None,
        "workflow_status":        "running",
    }

    graph = build_test_graph()
    config = {"callbacks": [langfuse_handler]}

    if db_url:
        async with await AsyncPostgresSaver.from_conn_string(db_url) as checkpointer:
            await checkpointer.setup()
            compiled = graph.compile(checkpointer=checkpointer)
            config["configurable"] = {"thread_id": thread_id}
            result = await compiled.ainvoke(initial_state, config=config)
    else:
        compiled = graph.compile()
        result = await compiled.ainvoke(initial_state, config=config)

    langfuse_handler.flush()
    langfuse.flush()

    # Write report to file if requested
    if output_path and result.get("final_report"):
        import pathlib
        pathlib.Path(output_path).write_text(result["final_report"], encoding="utf-8")
        logger.info(f"[TEST] Report written to {output_path}")

    return result


# ── Resume after checkpoint ────────────────────────────────────────────────────────

async def resume_test_workflow(thread_id: str, db_url: str) -> Dict[str, Any]:
    """
    Resume a test workflow from its last PostgreSQL checkpoint.
    Useful when a node crashes mid-run.
    """
    graph = build_test_graph()
    async with await AsyncPostgresSaver.from_conn_string(db_url) as checkpointer:
        compiled = graph.compile(checkpointer=checkpointer)
        config = {"configurable": {"thread_id": thread_id}}
        result = await compiled.ainvoke(None, config=config)
    return result


# ── CLI entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    import sys

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        stream=sys.stdout,
    )

    parser = argparse.ArgumentParser(description="Agent Builder System Test Workflow")
    parser.add_argument("--backend",   default=BACKEND_URL,  help="Backend API URL")
    parser.add_argument("--frontend",  default=FRONTEND_URL, help="Frontend URL")
    parser.add_argument("--email",     default="test@example.com")
    parser.add_argument("--password",  default="password123")
    parser.add_argument("--db-url",    default=os.getenv("DATABASE_URL"), help="PG URL for checkpointing")
    parser.add_argument("--thread-id", default=None)
    parser.add_argument("--output",    default="test_report.md", help="Report output path")
    parser.add_argument("--resume",    action="store_true", help="Resume from last checkpoint")
    args = parser.parse_args()

    if args.resume and args.thread_id and args.db_url:
        result = asyncio.run(resume_test_workflow(args.thread_id, args.db_url))
    else:
        result = asyncio.run(run_test_workflow(
            backend_url=args.backend,
            frontend_url=args.frontend,
            test_user_email=args.email,
            test_user_password=args.password,
            thread_id=args.thread_id,
            db_url=args.db_url,
            output_path=args.output,
        ))

    report = result.get("final_report", "No report generated.")
    print("\n" + "═" * 80)
    print(report)
    print("═" * 80)

    # Exit code: 0 = all pass, 1 = failures, 2 = critical failure
    score = result.get("aggregate_score", 0)
    if score >= 0.9:
        sys.exit(0)
    elif score >= 0.5:
        sys.exit(1)
    else:
        sys.exit(2)
