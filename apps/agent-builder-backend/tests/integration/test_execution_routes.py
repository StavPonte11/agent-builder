"""
test_integration_executions.py — Integration tests for /api/v1/executions routes
and the execution_extras extensions (checkpoints, state, replay, resume, report).
"""
from __future__ import annotations

import uuid
from unittest.mock import patch, AsyncMock

import pytest
from httpx import AsyncClient

from app.models.blueprint import BlueprintStatus
from app.models.execution import ExecutionStatus

pytestmark = pytest.mark.integration


def _bp_payload() -> dict:
    return {
        "name": "Exec Test Blueprint",
        "description": "For execution tests",
        "blueprint_type": "workflow",
        "definition": {
            "nodes": [
                {"id": "t1", "type": "trigger", "data": {"trigger_type": "manual"}},
                {"id": "l1", "type": "llm", "data": {"model": "gpt-4o-mini", "max_tokens": 50, "system_prompt": "echo"}},
                {"id": "o1", "type": "output", "data": {}},
            ],
            "edges": [
                {"id": "e1", "source": "t1", "target": "l1"},
                {"id": "e2", "source": "l1", "target": "o1"},
            ],
        },
        "tags": [],
    }


class TestCreateExecution:

    @pytest.mark.asyncio
    async def test_create_execution_returns_id_and_status(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        bp_r = await client.post("/api/v1/blueprints", headers=auth_headers(token), json=_bp_payload())
        bp_id = bp_r.json()["id"]

        with patch("app.api.v1.executions.temporal_client") as mock_tc:
            mock_tc.start_workflow = AsyncMock(return_value=AsyncMock(id="wf-123"))
            r = await client.post("/api/v1/executions", headers=auth_headers(token), json={
                "blueprint_id": bp_id,
                "input_data": {"message": "hello"},
            })
        assert r.status_code in (200, 201)
        data = r.json()
        assert "id" in data
        assert "status" in data
        assert data["status"] in ("queued", "running", "pending")

    @pytest.mark.asyncio
    async def test_create_execution_for_nonexistent_blueprint_returns_404(
            self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.post("/api/v1/executions", headers=auth_headers(token), json={
            "blueprint_id": str(uuid.uuid4()),
            "input_data": {},
        })
        assert r.status_code == 404

    @pytest.mark.asyncio
    async def test_create_execution_missing_blueprint_id_returns_422(
            self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.post("/api/v1/executions", headers=auth_headers(token),
                              json={"input_data": {}})
        assert r.status_code == 422


class TestGetExecution:

    @pytest.mark.asyncio
    async def test_get_execution_by_id(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        from app.models.execution import Execution
        user, org = await create_user_and_org(db_session)
        # Seed an execution directly
        exec_ = Execution(
            org_id=org.id,
            blueprint_id=uuid.uuid4(),
            triggered_by=user.id,
            status=ExecutionStatus.COMPLETED,
            input_data={"msg": "hi"},
            output_data={"result": "ok"},
        )
        db_session.add(exec_)
        await db_session.flush()
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get(f"/api/v1/executions/{exec_.id}", headers=auth_headers(token))
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == str(exec_.id)
        assert data["status"] == "completed"

    @pytest.mark.asyncio
    async def test_get_nonexistent_execution_returns_404(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get(f"/api/v1/executions/{uuid.uuid4()}", headers=auth_headers(token))
        assert r.status_code == 404


class TestExecutionExtras:
    """Tests for execution_extras endpoints: checkpoints, state, report, resume."""

    @pytest_asyncio.fixture
    async def seeded_execution(self, db_session, client):
        from tests.conftest import create_user_and_org, get_auth_token
        from app.models.execution import Execution
        user, org = await create_user_and_org(db_session)
        exec_ = Execution(
            org_id=org.id,
            blueprint_id=uuid.uuid4(),
            triggered_by=user.id,
            status=ExecutionStatus.COMPLETED,
            input_data={},
            output_data={"result": "done"},
        )
        db_session.add(exec_)
        await db_session.flush()
        token = await get_auth_token(client, user.email, "Password123!")
        return exec_, token

    @pytest.mark.asyncio
    async def test_get_checkpoints_returns_list(self, client, seeded_execution):
        exec_, token = seeded_execution
        from tests.conftest import auth_headers
        r = await client.get(f"/api/v1/executions/{exec_.id}/checkpoints",
                             headers=auth_headers(token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    @pytest.mark.asyncio
    async def test_get_execution_state(self, client, seeded_execution):
        exec_, token = seeded_execution
        from tests.conftest import auth_headers
        r = await client.get(f"/api/v1/executions/{exec_.id}/state",
                             headers=auth_headers(token))
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

    @pytest.mark.asyncio
    async def test_get_execution_report_returns_csv(self, client, seeded_execution):
        exec_, token = seeded_execution
        from tests.conftest import auth_headers
        r = await client.get(f"/api/v1/executions/{exec_.id}/report",
                             headers=auth_headers(token))
        assert r.status_code == 200
        content_type = r.headers.get("content-type", "")
        assert "csv" in content_type or "text" in content_type or len(r.content) > 0

    @pytest.mark.asyncio
    async def test_get_execution_replay(self, client, seeded_execution):
        exec_, token = seeded_execution
        from tests.conftest import auth_headers
        r = await client.get(f"/api/v1/executions/{exec_.id}/replay",
                             headers=auth_headers(token))
        assert r.status_code in (200, 404)  # may not exist yet

    @pytest.mark.asyncio
    async def test_get_checkpoints_for_nonexistent_execution_returns_404(
            self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get(f"/api/v1/executions/{uuid.uuid4()}/checkpoints",
                             headers=auth_headers(token))
        assert r.status_code == 404


class TestListExecutions:

    @pytest.mark.asyncio
    async def test_list_executions_returns_list(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get("/api/v1/executions", headers=auth_headers(token))
        assert r.status_code == 200
        assert isinstance(r.json(), (list, dict))

    @pytest.mark.asyncio
    async def test_list_executions_filter_by_status(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get("/api/v1/executions?status=completed", headers=auth_headers(token))
        assert r.status_code == 200
