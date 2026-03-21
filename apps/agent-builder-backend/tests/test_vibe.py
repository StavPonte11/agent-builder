#!/usr/bin/env python3
"""
test_vibe.py — Golden Run ("vibe check") test for the Agent Builder platform.

Exercises the full happy path:
  1. Backend health check
  2. Authenticate as test user
  3. Seed / find the Procurement Fraud Investigator blueprint
  4. Execute it with a synthetic invoice payload (auto-approves HITL in test mode)
  5. Poll until terminal state (max 90 s)
  6. Verify the output_1 node was reached and report is present
  7. Print a colour-coded pass/fail summary

Usage:
    python tests/test_vibe.py
    python tests/test_vibe.py --email admin@example.com --password Password123!
    python tests/test_vibe.py --backend http://staging.internal:8000

Exit codes: 0 = all passed, 1 = any failure.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

# ── Config ─────────────────────────────────────────────────────────────────────

BACKEND_URL  = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")
API_BASE     = f"{BACKEND_URL}/api/v1"
FRAUD_BP_PATH = Path(__file__).parent / "procurement_fraud_blueprint.json"

POLL_INTERVAL_S = 2
MAX_WAIT_S      = 90
TEST_INVOICE_PAYLOAD = {
    "invoice_pdf_url": "https://test-assets.example.com/invoice_ACME_001.pdf",
    "invoice_id":      "INV-TEST-GOLDEN-001",
    "submitted_by":    "golden-run-test@example.com",
    # Injected by test harness — bypasses actual LLM calls in mock mode
    "__test_mode":     True,
    "__mock_extracted_invoice": {
        "vendor_name":   "ACME Supplies Ltd",
        "invoice_date":  datetime.now(timezone.utc).date().isoformat(),
        "line_items":    [{"description": "Office Supplies", "quantity": 10, "unit_price": 50.0, "total": 500.0}],
        "total_amount":  500.0,
        "currency":      "USD",
    },
    "__mock_risk_level": "standard",  # → skip manager approval path
}

# ── Rich-like terminal helpers (no external deps beyond httpx) ─────────────────

ESC = "\033"
GREEN  = f"{ESC}[32m"
RED    = f"{ESC}[31m"
YELLOW = f"{ESC}[33m"
BLUE   = f"{ESC}[34m"
GREY   = f"{ESC}[90m"
BOLD   = f"{ESC}[1m"
RESET  = f"{ESC}[0m"

def ok(msg: str)    -> None: print(f"  {GREEN}✓{RESET} {msg}")
def fail(msg: str)  -> None: print(f"  {RED}✗{RESET} {msg}")
def warn(msg: str)  -> None: print(f"  {YELLOW}⚠{RESET} {msg}")
def info(msg: str)  -> None: print(f"  {BLUE}→{RESET} {msg}")
def dim(msg: str)   -> None: print(f"  {GREY}{msg}{RESET}")

def hr() -> None: print(f"  {GREY}{'─' * 58}{RESET}")


# ── Test steps ─────────────────────────────────────────────────────────────────

class VibeResult:
    def __init__(self) -> None:
        self.passed: list[str] = []
        self.failed: list[str] = []

    def record(self, name: str, passed: bool, detail: str = "") -> None:
        if passed:
            ok(f"{name}")
            self.passed.append(name)
        else:
            fail(f"{name}" + (f" — {detail}" if detail else ""))
            self.failed.append(name)

    def summary(self) -> int:
        """Returns exit code (0 ok, 1 fail)."""
        hr()
        total = len(self.passed) + len(self.failed)
        print(f"\n  {BOLD}Results: {GREEN}{len(self.passed)}{RESET}{BOLD}/{total} passed{RESET}")
        if self.failed:
            for f_name in self.failed:
                print(f"    {RED}✗ {f_name}{RESET}")
            print()
            return 1
        print(f"  {GREEN}{BOLD}All checks passed — platform is healthy 🚀{RESET}\n")
        return 0


async def run_vibe(email: str, password: str) -> int:
    result = VibeResult()

    print()
    print(f"  {BOLD}Agent Builder — Golden Run Test{RESET}")
    hr()
    print(f"  {GREY}Backend : {BACKEND_URL}{RESET}")
    print(f"  {GREY}Started : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{RESET}")
    hr()
    print()

    async with httpx.AsyncClient(base_url=API_BASE, timeout=30) as client:

        # ── Step 1: Health ────────────────────────────────────────────────────
        info("Step 1/7  Health check")
        try:
            r = await client.get("/health")
            healthy = r.status_code == 200
            result.record("Backend /health returns 200", healthy,
                          f"got {r.status_code}" if not healthy else "")
            if not healthy:
                return result.summary()
        except Exception as e:
            result.record("Backend /health reachable", False, str(e))
            return result.summary()

        # ── Step 2: Auth ──────────────────────────────────────────────────────
        info("Step 2/7  Authenticate")
        try:
            r = await client.post("/auth/login", json={"email": email, "password": password})
            if r.status_code == 200:
                token = r.json()["access_token"]
                headers = {"Authorization": f"Bearer {token}"}
                result.record("Login successful", True)
            else:
                result.record("Login successful", False, f"HTTP {r.status_code}: {r.text[:80]}")
                return result.summary()
        except Exception as e:
            result.record("Login successful", False, str(e))
            return result.summary()

        # ── Step 3: Seed / find Procurement Fraud blueprint ───────────────────
        info("Step 3/7  Seed Procurement Fraud blueprint")
        BLUEPRINT_TAG = "[GoldenRun] Procurement Fraud Investigator"
        bp_id: str | None = None
        try:
            list_r = await client.get("/blueprints", headers=headers)
            existing = [b for b in list_r.json() if BLUEPRINT_TAG in b.get("name", "")]

            if existing:
                bp_id = existing[0]["id"]
                dim(f"  Found existing: {bp_id}")
                result.record("Blueprint found / seeded", True)
            else:
                defn = json.loads(FRAUD_BP_PATH.read_text())
                clean = {k: v for k, v in defn.items() if not k.startswith("_")}
                clean["name"] = BLUEPRINT_TAG
                cr = await client.post("/blueprints", headers=headers, json=clean)
                if cr.status_code in (200, 201):
                    bp_id = cr.json()["id"]
                    dim(f"  Created: {bp_id}")
                    # Publish so it can be executed
                    await client.post(f"/blueprints/{bp_id}/publish", headers=headers,
                                      json={"release_notes": "Golden Run seed"})
                    result.record("Blueprint found / seeded", True)
                else:
                    result.record("Blueprint found / seeded", False,
                                  f"HTTP {cr.status_code}: {cr.text[:120]}")
                    return result.summary()
        except Exception as e:
            result.record("Blueprint found / seeded", False, str(e))
            return result.summary()

        # ── Step 4: Execute ───────────────────────────────────────────────────
        info("Step 4/7  Start execution")
        exec_id: str | None = None
        try:
            er = await client.post(
                f"/blueprints/{bp_id}/execute",
                headers=headers,
                json={"input": TEST_INVOICE_PAYLOAD, "options": {"auto_approve": True}},
            )
            if er.status_code in (200, 201, 202):
                exec_id = er.json().get("id") or er.json().get("execution_id")
                dim(f"  Execution ID: {exec_id}")
                result.record("Execution started", exec_id is not None,
                              "no id in response" if exec_id is None else "")
            else:
                result.record("Execution started", False,
                              f"HTTP {er.status_code}: {er.text[:120]}")
                return result.summary()
        except Exception as e:
            result.record("Execution started", False, str(e))
            return result.summary()

        # ── Step 5: Poll until terminal ───────────────────────────────────────
        info("Step 5/7  Poll until terminal state (max 90s)")
        TERMINAL = {"completed", "failed", "cancelled", "error"}
        start_t = time.monotonic()
        final_status: str = "unknown"
        try:
            while (elapsed := time.monotonic() - start_t) < MAX_WAIT_S:
                sr = await client.get(f"/executions/{exec_id}", headers=headers)
                if sr.status_code == 200:
                    body = sr.json()
                    status = body.get("status", "unknown")
                    dim(f"    [{elapsed:5.1f}s] status={status}")
                    if status in TERMINAL:
                        final_status = status
                        break
                await asyncio.sleep(POLL_INTERVAL_S)
            else:
                final_status = "timeout"

            timed_out = final_status == "timeout"
            result.record("Execution reached terminal state",
                          not timed_out,
                          f"timed out after {MAX_WAIT_S}s" if timed_out else f"status={final_status}")
        except Exception as e:
            result.record("Execution reached terminal state", False, str(e))

        # ── Step 6: Verify output node was reached ────────────────────────────
        info("Step 6/7  Verify output_1 node reached")
        try:
            cr = await client.get(f"/executions/{exec_id}/checkpoints", headers=headers)
            if cr.status_code == 200:
                checkpoints = cr.json()
                output_reached = any(
                    c.get("node_id") == "output_1" and c.get("status") == "completed"
                    for c in checkpoints
                )
                result.record("output_1 node completed", output_reached,
                              f"completed nodes: {[c['node_id'] for c in checkpoints if c.get('status') == 'completed']}")
            else:
                result.record("output_1 node completed", False,
                              f"checkpoints returned HTTP {cr.status_code}")
        except Exception as e:
            result.record("output_1 node completed", False, str(e))

        # ── Step 7: Verify execution completed (not failed) ───────────────────
        info("Step 7/7  Final status check")
        result.record("Execution status = completed",
                      final_status == "completed",
                      f"actual status: {final_status}")

    print()
    return result.summary()


# ── Entry point ────────────────────────────────────────────────────────────────

async def main() -> None:
    parser = argparse.ArgumentParser(description="Agent Builder Golden Run Test")
    parser.add_argument("--backend",  default=BACKEND_URL, help="Backend API base URL")
    parser.add_argument("--email",    default=os.getenv("TEST_USER_EMAIL", "admin@example.com"))
    parser.add_argument("--password", default=os.getenv("TEST_USER_PASSWORD", "Password123!"))
    args = parser.parse_args()

    global API_BASE
    API_BASE = f"{args.backend}/api/v1"

    exit_code = await run_vibe(args.email, args.password)
    sys.exit(exit_code)


if __name__ == "__main__":
    asyncio.run(main())
