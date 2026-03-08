"""
test_system_e2e.py — pytest entry point for the agentic system test workflow.

Wraps test_workflow.run_test_workflow() in pytest so CI can run it like any other test suite.

Usage:
  pytest tests/test_system_e2e.py -v -m system
  pytest tests/test_system_e2e.py -v -m system --timeout=300

Or run standalone (no pytest):
  python tests/test_workflow.py --output report.md

Or with PostgreSQL checkpointing (enables resume on failure):
  python tests/test_workflow.py --db-url postgresql+asyncpg://... --output report.md
"""
from __future__ import annotations

import asyncio
import os
import pathlib
import pytest
from typing import Any, Dict


# ── Run the full agentic workflow once per session ───────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    """Session-scoped event loop so the workflow runs once for all tests."""
    import asyncio
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def test_result(backend_url, frontend_url, test_user_email, test_user_password, db_url) -> Dict[str, Any]:
    """
    Runs the complete LangGraph workflow once per test session.
    All individual test functions below just inspect this shared result.
    """
    from tests.test_workflow import run_test_workflow

    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(run_test_workflow(
        backend_url=backend_url,
        frontend_url=frontend_url,
        test_user_email=test_user_email,
        test_user_password=test_user_password,
        db_url=db_url,
        output_path="test_report.md",
    ))
    return result


# ── Individual pytest assertions ─────────────────────────────────────────────────

@pytest.mark.system
@pytest.mark.api
class TestBackendAPIs:
    """pytest wrappers around the API test phase of the workflow."""

    def test_backend_health(self, test_result):
        assert test_result["backend_healthy"], \
            f"Backend unreachable. Health: {test_result.get('health_details', {}).get('backend')}"

    def test_api_tests_ran(self, test_result):
        results = test_result.get("api_test_results", [])
        assert len(results) > 0, "No API tests were executed"

    def test_api_pass_rate(self, test_result):
        results = test_result.get("api_test_results", [])
        passed = sum(1 for r in results if r["passed"])
        total = len(results)
        pass_rate = passed / total if total else 0
        assert pass_rate >= 0.7, \
            f"API pass rate too low: {passed}/{total} ({pass_rate:.1%}). " \
            f"Failures: {[r['name'] for r in results if not r['passed']]}"

    def test_blueprint_crud_passed(self, test_result):
        results = test_result.get("api_test_results", [])
        blueprint_tests = [r for r in results if "Blueprint" in r["name"]]
        failed = [r["name"] for r in blueprint_tests if not r["passed"]]
        assert not failed, f"Blueprint API tests failed: {failed}"

    def test_tools_endpoint(self, test_result):
        results = test_result.get("api_test_results", [])
        tool_tests = [r for r in results if "Tools" in r["name"]]
        assert any(r["passed"] for r in tool_tests), \
            f"Tools API test failed: {[r['error'] for r in tool_tests]}"


@pytest.mark.system
class TestBlueprintLifecycle:
    """pytest wrappers around the lifecycle test phase."""

    def test_lifecycle_tests_ran(self, test_result):
        results = test_result.get("lifecycle_test_results", [])
        assert len(results) > 0, "No lifecycle tests ran — check if blueprint creation succeeded"

    def test_execution_created(self, test_result):
        results = test_result.get("lifecycle_test_results", [])
        exec_test = next((r for r in results if "Create execution" in r["name"]), None)
        if exec_test is None:
            pytest.skip("Execution test not run (blueprint may not have been created)")
        assert exec_test["passed"], f"Execution creation failed: {exec_test.get('error')}"

    def test_execution_reached_terminal_state(self, test_result):
        results = test_result.get("lifecycle_test_results", [])
        terminal_test = next((r for r in results if "terminal state" in r["name"]), None)
        if terminal_test is None:
            pytest.skip("Terminal state test not run")
        assert terminal_test["passed"], f"Execution never reached terminal: {terminal_test.get('details')}"

    def test_checkpoints_returned(self, test_result):
        results = test_result.get("lifecycle_test_results", [])
        cp_test = next((r for r in results if "checkpoint" in r["name"].lower()), None)
        if cp_test is None:
            pytest.skip("Checkpoint test not run")
        assert cp_test["passed"], f"Checkpoint endpoint failed: {cp_test.get('error')}"

    def test_csv_report_generated(self, test_result):
        results = test_result.get("lifecycle_test_results", [])
        report_test = next((r for r in results if "CSV report" in r["name"]), None)
        if report_test is None:
            pytest.skip("Report test not run")
        assert report_test["passed"], f"CSV report failed: {report_test.get('error')}"


@pytest.mark.system
class TestStreaming:
    """pytest wrappers around WebSocket streaming tests."""

    def test_streaming_tests_ran(self, test_result):
        results = test_result.get("stream_test_results", [])
        assert len(results) > 0, "No streaming tests ran"

    def test_websocket_connects_or_fallback(self, test_result):
        results = test_result.get("stream_test_results", [])
        # At least one streaming test should pass (WebSocket or HTTP fallback)
        assert any(r["passed"] for r in results), \
            f"All streaming tests failed: {[r['error'] for r in results]}"


@pytest.mark.system
@pytest.mark.ui
class TestUIPages:
    """pytest wrappers around Playwright UI smoke tests."""

    def test_ui_tests_ran(self, test_result):
        results = test_result.get("ui_test_results", [])
        if not results:
            pytest.skip("UI tests not run (Playwright not installed or frontend down)")

    def test_login_page_loads(self, test_result):
        results = test_result.get("ui_test_results", [])
        login_test = next((r for r in results if "Login" in r["name"]), None)
        if login_test is None:
            pytest.skip("Login page test not run")
        assert login_test["passed"], f"Login page broken: {login_test.get('error')}"

    def test_dashboard_loads(self, test_result):
        results = test_result.get("ui_test_results", [])
        dash_test = next((r for r in results if "Dashboard" in r["name"]), None)
        if dash_test is None:
            pytest.skip("Dashboard test not run")
        assert dash_test["passed"], f"Dashboard broken: {dash_test.get('error')}"

    def test_ui_pass_rate(self, test_result):
        results = test_result.get("ui_test_results", [])
        if not results:
            pytest.skip("No UI tests")
        passed = sum(1 for r in results if r["passed"])
        total = len(results)
        assert passed / total >= 0.7, \
            f"UI pass rate too low: {passed}/{total}. Failures: {[r['name'] for r in results if not r['passed']]}"


@pytest.mark.system
class TestEvaluation:
    """pytest wrappers around LLM judge evaluation phase."""

    def test_aggregate_score_acceptable(self, test_result):
        score = test_result.get("aggregate_score", 0)
        assert score >= 0.5, \
            f"Aggregate score too low: {score:.2f}. Judge reasoning: {test_result.get('judge_reasoning', '')[:200]}"

    def test_report_generated(self, test_result):
        report = test_result.get("final_report")
        assert report is not None and len(report) > 100, \
            "Final report not generated or too short"

    def test_report_written_to_disk(self):
        assert pathlib.Path("test_report.md").exists(), \
            "test_report.md not found on disk"

    def test_workflow_status_completed(self, test_result):
        status = test_result.get("workflow_status")
        assert status == "completed", f"Workflow ended with status: {status}"
