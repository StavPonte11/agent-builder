"""
demo_e2e.py — Infrastructure Analysis Workflow: Platform Edition Demo
======================================================================
Demonstrates the full Agent Builder platform lifecycle by building and
running the equivalent of orchestrator.py *inside the platform*:

  1. CREATE   — Register the blueprint from demo_blueprint.json
  2. VALIDATE — Run the platform's validation pipeline
  3. PUBLISH  — Publish to the org (creates v1)
  4. EXECUTE  — Fire the workflow with a test incident report
  5. STREAM   — Watch all events via WebSocket in real-time
  6. REVIEW   — Inspect checkpoints, node outputs, and state
  7. EVALUATE — LLM judge scores the run on 5 dimensions
  8. REPORT   — Print a full summary

This replaces what orchestrator.py does with custom LangGraph code:
the platform handles state, persistence, parallelism, and human-in-the-loop.

USAGE:
  python tests/demo_e2e.py
  python tests/demo_e2e.py --email admin@org.com --password secret
  python tests/demo_e2e.py --report-only --execution-id <uuid>

ENVIRONMENT:
  BACKEND_BASE_URL   (default: http://localhost:8000)
  TEST_USER_EMAIL    (default: test@example.com)
  TEST_USER_PASSWORD (default: password123)
  OPENAI_API_KEY     (required for LLM evaluation step)
  LANGFUSE_*         (optional, for observability)
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
import websockets
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

# Optional Langfuse
try:
    from langfuse import Langfuse
    from langfuse.callback import CallbackHandler
    langfuse = Langfuse(
        public_key=os.getenv("LANGFUSE_PUBLIC_KEY", ""),
        secret_key=os.getenv("LANGFUSE_SECRET_KEY", ""),
        host=os.getenv("LANGFUSE_HOST", "http://localhost:3100"),
    )
    LANGFUSE_ENABLED = bool(os.getenv("LANGFUSE_PUBLIC_KEY"))
except ImportError:
    langfuse = None
    LANGFUSE_ENABLED = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

BACKEND_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")
API_BASE    = f"{BACKEND_URL}/api/v1"
BLUEPRINT_DEF_PATH = Path(__file__).parent / "demo_blueprint.json"

# ── 5 test scenarios covering the orchestrator's 3 main paths ──────────────────

TEST_SCENARIOS = [
    {
        "name": "L2 Critical — Power grid outage",
        "input": {
            "report_text": (
                "URGENT: Complete power failure reported at the Central Distribution "
                "Hub in Springfield. All backup generators offline. Facilities at "
                "Lincoln Park and Pine Ridge are on emergency reserves. Situation "
                "deteriorating rapidly."
            ),
            "trigger_type": "report",
        },
        "expected": {
            "is_relevant": True,
            "min_escalation": 1,
            "expect_notifications": True,
        },
    },
    {
        "name": "L0 Normal — Routine maintenance",
        "input": {
            "report_text": "Scheduled maintenance window on AC unit at Site B. No service impact expected.",
            "trigger_type": "report",
        },
        "expected": {
            "is_relevant": True,
            "min_escalation": 0,
            "expect_notifications": False,
        },
    },
    {
        "name": "Irrelevant — Weather forecast",
        "input": {
            "report_text": "Tomorrow's forecast: sunny skies with a high of 72°F across the region.",
            "trigger_type": "report",
        },
        "expected": {
            "is_relevant": False,
            "min_escalation": 0,
            "expect_notifications": False,
        },
    },
    {
        "name": "Manual — Pre-identified sites",
        "input": {
            "report_text": "",
            "site_names": ["North Plant Alpha", "Substation-7"],
            "trigger_type": "manual",
        },
        "expected": {
            "is_relevant": True,
            "min_escalation": 0,
            "expect_notifications": False,
        },
    },
    {
        "name": "L1 Elevated — Network intrusion alert",
        "input": {
            "report_text": (
                "Security alert: unauthorized access detected on SCADA systems at "
                "Riverside Power Station. Partial lockdown initiated. 3 facilities "
                "affected. Backup control systems engaged."
            ),
            "trigger_type": "alert",
        },
        "expected": {
            "is_relevant": True,
            "min_escalation": 1,
            "expect_notifications": True,
        },
    },
]

# ── Evaluation rubric (mirrors evaluation_config in demo_blueprint.json) ────────

JUDGE_SYSTEM = """You are a quality evaluator for an infrastructure analysis AI platform.
Score the workflow execution on these 5 dimensions, each 0.0 to 1.0:

1. classification_accuracy — Did the platform correctly identify if the report is infrastructure-relevant?
2. entity_resolution_quality — Were the correct sites resolved from the report text?
3. notification_correctness — Were the right tools triggered for the escalation level? (L0=none, L1+=alerts)
4. summary_quality — Is the operational brief concise, factual, complete (what/degraded/backup/action)?
5. latency_sla — Did the execution finish in <60s? (1.0=<60s, 0.5=<120s, 0.0=>=120s)

Respond ONLY as JSON:
{
  "classification_accuracy": float,
  "entity_resolution_quality": float,
  "notification_correctness": float,
  "summary_quality": float,
  "latency_sla": float,
  "weighted_score": float,
  "verdict": "PASS" | "FAIL",
  "reasoning": "2-3 sentence assessment",
  "issues": ["specific issue if any"]
}"""


# ── HTTP Client ──────────────────────────────────────────────────────────────────

class PlatformClient:
    def __init__(self, base_url: str, token: str = None):
        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self._token = token
        self._base = base_url
        self.http = httpx.AsyncClient(base_url=base_url, headers=headers,
                                      timeout=60.0, follow_redirects=True)

    async def login(self, email: str, password: str) -> str:
        r = await self.http.post("/auth/login", json={"email": email, "password": password})
        r.raise_for_status()
        data = r.json()
        token = data.get("access_token") or data.get("token", "")
        self.http.headers["Authorization"] = f"Bearer {token}"
        self._token = token
        return token

    async def create_blueprint(self, definition: Dict) -> Dict:
        r = await self.http.post("/blueprints", json=definition)
        r.raise_for_status()
        return r.json()

    async def validate_blueprint(self, bp_id: str) -> Dict:
        r = await self.http.post("/blueprints/validate", json={"blueprint_id": bp_id})
        r.raise_for_status()
        return r.json()

    async def publish_blueprint(self, bp_id: str, notes: str = "") -> Dict:
        r = await self.http.post(f"/blueprints/{bp_id}/publish",
                                 json={"release_notes": notes})
        r.raise_for_status()
        return r.json()

    async def execute(self, bp_id: str, input_data: Dict) -> Dict:
        r = await self.http.post("/executions",
                                 json={"blueprint_id": bp_id, "input_data": input_data})
        r.raise_for_status()
        return r.json()

    async def get_execution(self, exec_id: str) -> Dict:
        r = await self.http.get(f"/executions/{exec_id}")
        r.raise_for_status()
        return r.json()

    async def get_checkpoints(self, exec_id: str) -> List[Dict]:
        r = await self.http.get(f"/executions/{exec_id}/checkpoints")
        r.raise_for_status()
        return r.json()

    async def get_execution_state(self, exec_id: str) -> Dict:
        r = await self.http.get(f"/executions/{exec_id}/state")
        r.raise_for_status()
        return r.json()

    async def get_report_csv(self, exec_id: str) -> bytes:
        r = await self.http.get(f"/executions/{exec_id}/report")
        r.raise_for_status()
        return r.content

    async def get_blueprint_versions(self, bp_id: str) -> List[Dict]:
        r = await self.http.get(f"/blueprints/{bp_id}/versions")
        r.raise_for_status()
        return r.json()

    async def close(self):
        await self.http.aclose()

    @property
    def ws_url(self) -> str:
        return self._base.replace("http://", "ws://").replace("https://", "wss://")

    def make_ws_url(self, exec_id: str) -> str:
        return f"{self.ws_url}/ws/executions/{exec_id}"


# ── Step 1: Create & Publish ────────────────────────────────────────────────────

async def step_create_and_publish(
    client: PlatformClient,
    trace_id: str,
) -> str:
    """Create the blueprint from JSON, validate, and publish it. Returns blueprint_id."""

    print("\n" + "─" * 60)
    print("  STEP 1 — CREATE & PUBLISH BLUEPRINT")
    print("─" * 60)

    defn = json.loads(BLUEPRINT_DEF_PATH.read_text())
    defn["name"] = f"[Demo] {defn['name']} — {datetime.now(timezone.utc).strftime('%H:%M')}"

    t0 = time.monotonic()
    bp = await client.create_blueprint(defn)
    bp_id = bp["id"]
    logger.info(f"  ✅ Created: {bp_id}  ({int((time.monotonic()-t0)*1000)}ms)")

    # Validate
    t0 = time.monotonic()
    val = await client.validate_blueprint(bp_id)
    errors = val.get("errors", [])
    warnings = val.get("warnings", [])
    logger.info(f"  📋 Validated: {len(errors)} errors, {len(warnings)} warnings  ({int((time.monotonic()-t0)*1000)}ms)")
    if errors:
        logger.warning(f"  ⚠️  Validation errors: {errors}")

    # Publish
    t0 = time.monotonic()
    try:
        pub = await client.publish_blueprint(bp_id, "Demo run — auto-published")
        logger.info(f"  🚀 Published v{pub.get('version_number', 1)}  ({int((time.monotonic()-t0)*1000)}ms)")
    except httpx.HTTPStatusError as e:
        logger.warning(f"  ⚠️  Publish failed ({e.response.status_code}), continuing with draft")

    print(f"\n  Blueprint ID: {bp_id}")
    return bp_id


# ── Step 2: Execute + Stream ─────────────────────────────────────────────────────

async def step_execute_and_stream(
    client: PlatformClient,
    bp_id: str,
    scenario: Dict,
) -> Dict:
    """Execute one test scenario and collect all WebSocket events. Returns enriched result."""

    print(f"\n  ▶  {scenario['name']}")
    t0 = time.monotonic()

    exec_resp = await client.execute(bp_id, scenario["input"])
    exec_id = exec_resp["id"]
    logger.info(f"     Execution started: {exec_id}")

    # ── WebSocket stream ─────────────────────────────────────────────────────────
    events: List[Dict] = []
    ws_url = client.make_ws_url(exec_id)
    try:
        headers = {"Authorization": f"Bearer {client._token}"} if client._token else {}
        async with websockets.connect(ws_url, extra_headers=headers, open_timeout=5) as ws:
            try:
                while True:
                    raw = await asyncio.wait_for(ws.recv(), timeout=90.0)
                    evt = json.loads(raw)
                    events.append(evt)
                    _print_event(evt)
                    if evt.get("type") in ("execution_completed", "execution_failed"):
                        break
            except asyncio.TimeoutError:
                logger.warning("     WebSocket timed out waiting for completion")
    except Exception as e:
        logger.warning(f"     WebSocket unavailable ({e}), polling instead")
        # Fallback: poll
        for _ in range(120):
            await asyncio.sleep(1)
            exec_data = await client.get_execution(exec_id)
            if exec_data.get("status") in ("completed", "failed", "cancelled"):
                break

    duration_ms = int((time.monotonic() - t0) * 1000)
    final_exec = await client.get_execution(exec_id)

    return {
        "scenario": scenario,
        "execution_id": exec_id,
        "status": final_exec.get("status"),
        "duration_ms": duration_ms,
        "events": events,
        "node_outputs": final_exec.get("node_outputs", {}),
        "output_data": final_exec.get("output_data", {}),
    }


def _print_event(evt: Dict):
    t = evt.get("type", "unknown")
    node = evt.get("node_id", "")
    icons = {
        "node_queued":        "  ⏳",  "node_started":      "  🔵",
        "node_streaming":     "  💬",  "node_completed":    "  ✅",
        "node_failed":        "  ❌",  "node_skipped":      "  ⏭️",
        "node_retrying":      "  🔄",  "execution_completed": "  🏁",
        "execution_failed":   "  💥",  "cost_update":       "  💰",
        "approval_required":  "  🛑",  "approval_resolved": "  👍",
        "state_updated":      "  📦",  "heartbeat":         "  💓",
        "guardrail_triggered":"  🛡️",
    }
    icon = icons.get(t, "  📌")
    suffix = f" [{node}]" if node else ""
    if t == "cost_update":
        suffix += f"  tokens={evt.get('data', {}).get('total_tokens', '?')}"
    elif t in ("node_completed",) and "output" in evt.get("data", {}):
        out = str(evt["data"]["output"])[:60]
        suffix += f"  → {out}…" if len(out) == 60 else f"  → {out}"
    logger.info(f"     {icon} {t}{suffix}")


# ── Step 3: Review ───────────────────────────────────────────────────────────────

async def step_review_execution(
    client: PlatformClient,
    result: Dict,
) -> Dict:
    """Inspect checkpoints, state, and generate a node-by-node trace."""

    exec_id = result["execution_id"]
    print(f"\n     📋 REVIEWING: {exec_id}")

    checkpoints = await client.get_checkpoints(exec_id)
    state       = await client.get_execution_state(exec_id)
    csv_report  = await client.get_report_csv(exec_id)

    # Write CSV report
    report_path = Path(f"execution_{exec_id[:8]}_report.csv")
    report_path.write_bytes(csv_report)

    node_trace = []
    for cp in checkpoints:
        node_trace.append({
            "node_id":     cp.get("node_id"),
            "status":      cp.get("status"),
            "duration_ms": cp.get("duration_ms"),
            "output_keys": list(cp.get("output", {}).keys()),
        })

    # Print node trace
    logger.info("     Node execution trace:")
    for n in node_trace:
        status_icon = "✅" if n["status"] == "completed" else ("⏭️" if n["status"] == "skipped" else "❌")
        logger.info(f"       {status_icon} {n['node_id']:<35} {n['duration_ms'] or '?':>6}ms  keys={n['output_keys']}")

    # Extract key outputs from final state
    extracted = {
        "is_relevant":      state.get("is_relevant"),
        "escalation_level": state.get("escalation_level"),
        "resolved_sites":   state.get("resolved_sites", []),
        "final_summary":    state.get("final_summary", ""),
        "slack_sent":       state.get("slack_sent", False),
        "pagerduty_sent":   state.get("pagerduty_sent", False),
        "email_sent":       state.get("email_sent", False),
    }

    logger.info(f"     State snapshot: {json.dumps(extracted, indent=6)}")
    logger.info(f"     CSV report written → {report_path}")

    return {
        "checkpoints": checkpoints,
        "node_trace": node_trace,
        "extracted_state": extracted,
        "csv_report_path": str(report_path),
    }


# ── Step 4: Evaluate ─────────────────────────────────────────────────────────────

async def step_evaluate(
    result: Dict,
    review: Dict,
    llm: ChatOpenAI,
    trace_id: str,
) -> Dict:
    """LLM judge evaluation against the 5 rubric dimensions."""

    scenario  = result["scenario"]
    expected  = scenario["expected"]
    extracted = review["extracted_state"]
    node_trace_str = "\n".join(
        f"  - {n['node_id']}: {n['status']} ({n['duration_ms']}ms)"
        for n in review["node_trace"]
    )

    prompt = f"""SCENARIO: {scenario['name']}
INPUT: {json.dumps(scenario['input'], indent=2)}

EXPECTED: is_relevant={expected['is_relevant']}, min_escalation={expected['min_escalation']}, notifications_expected={expected['expect_notifications']}

ACTUAL EXECUTION:
- Status:           {result['status']}
- Duration:         {result['duration_ms']}ms
- is_relevant:      {extracted['is_relevant']}
- escalation_level: {extracted['escalation_level']}
- resolved_sites:   {extracted['resolved_sites']}
- slack_sent:       {extracted['slack_sent']}
- pagerduty_sent:   {extracted['pagerduty_sent']}
- email_sent:       {extracted['email_sent']}
- final_summary:    {extracted['final_summary'][:500]}

NODE TRACE:
{node_trace_str}

WebSocket events received: {len(result['events'])} event(s)"""

    try:
        response = await llm.ainvoke([
            SystemMessage(content=JUDGE_SYSTEM),
            HumanMessage(content=prompt),
        ])
        scores = json.loads(response.content)
    except Exception as e:
        logger.error(f"     LLM evaluation failed: {e}")
        scores = {
            "classification_accuracy": 1.0 if extracted["is_relevant"] == expected["is_relevant"] else 0.0,
            "entity_resolution_quality": 0.5,
            "notification_correctness": 0.5,
            "summary_quality": 0.5,
            "latency_sla": 1.0 if result["duration_ms"] < 60000 else 0.0,
            "weighted_score": 0.5,
            "verdict": "FAIL",
            "reasoning": f"Evaluation LLM error: {e}",
            "issues": [],
        }

    verdict = scores.get("verdict", "FAIL")
    wscore  = scores.get("weighted_score", 0)
    verdict_icon = "✅" if verdict == "PASS" else "❌"
    logger.info(f"     {verdict_icon} VERDICT: {verdict}  score={wscore:.2f}  — {scores.get('reasoning', '')[:120]}")

    # Score to Langfuse
    if LANGFUSE_ENABLED and langfuse:
        for dim, val in scores.items():
            if isinstance(val, float):
                langfuse.score(
                    trace_id=trace_id,
                    name=f"{scenario['name'][:20]}_{dim}",
                    value=val,
                )

    return scores


# ── Final report ─────────────────────────────────────────────────────────────────

def print_final_report(
    bp_id: str,
    all_results: List[Dict],  # list of {result, review, scores}
    started_at: str,
) -> None:
    total    = len(all_results)
    passed   = sum(1 for r in all_results if r["scores"].get("verdict") == "PASS")
    avg      = sum(r["scores"].get("weighted_score", 0) for r in all_results) / max(total, 1)
    bar      = "█" * int(avg * 20) + "░" * (20 - int(avg * 20))
    duration = sum(r["result"]["duration_ms"] for r in all_results)

    report = f"""
{'═' * 70}
  AGENT BUILDER PLATFORM — INFRASTRUCTURE WORKFLOW DEMO REPORT
{'═' * 70}

  Blueprint ID : {bp_id}
  Started      : {started_at}
  Scenarios    : {total}
  Passed       : {passed} / {total}
  Avg Score    : {avg:.2f}  [{bar}]
  Total Time   : {duration/1000:.1f}s

{'─' * 70}
{'  #':<4} {'Scenario':<35} {'Status':<12} {'Score':<8} {'Duration':<10}
{'─' * 70}"""

    for i, entry in enumerate(all_results, 1):
        r = entry["result"]
        s = entry["scores"]
        verdict = s.get("verdict", "?")
        icon    = "✅" if verdict == "PASS" else "❌"
        report += f"""
  {i:<3} {r['scenario']['name']:<35} {icon} {verdict:<10} {s.get('weighted_score', 0):<8.2f} {r['duration_ms']/1000:<6.1f}s"""

    report += f"\n{'─' * 70}\n"

    # Per-scenario breakdown
    for entry in all_results:
        r  = entry["result"]
        s  = entry["scores"]
        ex = entry["review"]["extracted_state"]
        report += f"""
  ── {r['scenario']['name']} ──
     Execution: {r['execution_id']}
     Verdict:   {s.get('verdict')} ({s.get('weighted_score', 0):.2f})
     Reasoning: {s.get('reasoning', 'n/a')}
     State:     is_relevant={ex['is_relevant']}  escalation={ex['escalation_level']}
                sites={ex['resolved_sites']}
                notifications: Slack={ex['slack_sent']} PD={ex['pagerduty_sent']} Email={ex['email_sent']}
     Summary:   {ex['final_summary'][:200]}…
"""
        if s.get("issues"):
            report += f"     Issues:    {s['issues']}\n"

    report += f"\n{'═' * 70}\n"
    print(report)

    # Save report
    report_path = Path("demo_report.md")
    report_path.write_text(report, encoding="utf-8")
    logger.info(f"Report saved → {report_path}")


# ── Entry point ───────────────────────────────────────────────────────────────────

async def run_demo(
    backend_url: str = BACKEND_URL,
    email: str = "test@example.com",
    password: str = "password123",
    scenarios: List[str] = None,
    report_only_exec_id: str = None,
):
    started_at = datetime.now(timezone.utc).isoformat()
    trace_id   = str(uuid.uuid4())

    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0,
        api_key=os.getenv("OPENAI_API_KEY"),
    )

    client = PlatformClient(f"{backend_url}/api/v1")
    print(f"\n{'═'*70}")
    print(f"  Infrastructure Analysis Workflow — Platform Demo")
    print(f"  Backend: {backend_url}")
    print(f"{'═'*70}")

    # Auth
    try:
        token = await client.login(email, password)
        logger.info(f"  ✅ Authenticated as {email}")
    except Exception as e:
        logger.error(f"  ❌ Auth failed: {e}")
        await client.close()
        return

    # Filter scenarios
    schemas = TEST_SCENARIOS
    if scenarios:
        schemas = [s for s in TEST_SCENARIOS if any(kw.lower() in s["name"].lower() for kw in scenarios)]

    # ── Step 1: Create & publish ───────────────────────────────────────────────
    bp_id = await step_create_and_publish(client, trace_id)

    # ── Steps 2–4: Execute, review, evaluate per scenario ─────────────────────
    all_results = []
    for scenario in schemas:
        try:
            print(f"\n{'─'*60}")
            print(f"  STEP 2 — EXECUTE: {scenario['name']}")
            result = await step_execute_and_stream(client, bp_id, scenario)

            print(f"  STEP 3 — REVIEW")
            review = await step_review_execution(client, result)

            print(f"  STEP 4 — EVALUATE")
            scores = await step_evaluate(result, review, llm, trace_id)

            all_results.append({"result": result, "review": review, "scores": scores})
        except Exception as e:
            logger.error(f"  ❌ Scenario '{scenario['name']}' failed: {e}")
            all_results.append({
                "result": {"scenario": scenario, "execution_id": "?", "status": "error",
                           "duration_ms": 0, "events": [], "node_outputs": {}, "output_data": {}},
                "review": {"checkpoints": [], "node_trace": [], "extracted_state": {}, "csv_report_path": ""},
                "scores": {"verdict": "FAIL", "weighted_score": 0.0, "reasoning": str(e), "issues": [str(e)]},
            })

    # ── Step 5: Versions ───────────────────────────────────────────────────────
    try:
        versions = await client.get_blueprint_versions(bp_id)
        logger.info(f"\n  🗂  Blueprint versions: {len(versions)}")
        for v in versions:
            logger.info(f"     v{v.get('version_number')}: {v.get('status')} — {v.get('release_notes', '')[:60]}")
    except Exception:
        pass

    # ── Final report ───────────────────────────────────────────────────────────
    print(f"\n{'─'*60}")
    print("  STEP 5 — FINAL REPORT")
    print_final_report(bp_id, all_results, started_at)

    if LANGFUSE_ENABLED and langfuse:
        langfuse.flush()

    await client.close()


# ── CLI ───────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Agent Builder Platform Demo — Infrastructure Workflow")
    parser.add_argument("--backend",   default=BACKEND_URL)
    parser.add_argument("--email",     default=os.getenv("TEST_USER_EMAIL", "test@example.com"))
    parser.add_argument("--password",  default=os.getenv("TEST_USER_PASSWORD", "password123"))
    parser.add_argument("--scenarios", nargs="*", help="Filter scenarios by keyword (e.g. 'critical')")
    args = parser.parse_args()

    asyncio.run(run_demo(
        backend_url=args.backend,
        email=args.email,
        password=args.password,
        scenarios=args.scenarios,
    ))
