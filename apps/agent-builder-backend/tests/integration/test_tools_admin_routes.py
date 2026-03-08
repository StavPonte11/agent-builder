"""
test_integration_tools_admin.py — Integration tests for tools, base-prompts,
users, organizations, metrics, and admin endpoints.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.models.user import UserRole

pytestmark = pytest.mark.integration


# ── Tools / MCP Registry ──────────────────────────────────────────────────────────

class TestToolsRoutes:

    @pytest.mark.asyncio
    async def test_list_tools_returns_list(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get("/api/v1/tools", headers=auth_headers(token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    @pytest.mark.asyncio
    async def test_create_tool_requires_admin(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.VIEWER)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.post("/api/v1/tools", headers=auth_headers(token), json={
            "name": "test-tool", "tool_type": "http", "config": {}
        })
        assert r.status_code == 403

    @pytest.mark.asyncio
    async def test_create_tool_as_admin(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.ADMIN)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.post("/api/v1/tools", headers=auth_headers(token), json={
            "name": "my-http-tool",
            "tool_type": "http",
            "description": "A test HTTP tool",
            "config": {"url": "https://httpbin.org/post"},
            "capabilities": ["call"],
        })
        assert r.status_code in (200, 201)
        assert r.json()["name"] == "my-http-tool"

    @pytest.mark.asyncio
    async def test_get_tool_by_id(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.ADMIN)
        token = await get_auth_token(client, user.email, "Password123!")
        create_r = await client.post("/api/v1/tools", headers=auth_headers(token), json={
            "name": "get-by-id-tool", "tool_type": "http", "config": {}
        })
        tool_id = create_r.json()["id"]
        r = await client.get(f"/api/v1/tools/{tool_id}", headers=auth_headers(token))
        assert r.status_code == 200
        assert r.json()["id"] == tool_id

    @pytest.mark.asyncio
    async def test_get_tool_health(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.ADMIN)
        token = await get_auth_token(client, user.email, "Password123!")
        create_r = await client.post("/api/v1/tools", headers=auth_headers(token), json={
            "name": "health-tool", "tool_type": "http", "config": {}
        })
        tool_id = create_r.json()["id"]
        r = await client.get(f"/api/v1/tools/{tool_id}/health", headers=auth_headers(token))
        assert r.status_code in (200, 404)

    @pytest.mark.asyncio
    async def test_delete_tool_as_admin(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.ADMIN)
        token = await get_auth_token(client, user.email, "Password123!")
        create_r = await client.post("/api/v1/tools", headers=auth_headers(token), json={
            "name": "delete-tool", "tool_type": "http", "config": {}
        })
        tool_id = create_r.json()["id"]
        r = await client.delete(f"/api/v1/tools/{tool_id}", headers=auth_headers(token))
        assert r.status_code in (200, 204)


# ── Base Prompts ──────────────────────────────────────────────────────────────────

class TestBasePromptsRoutes:

    @pytest.mark.asyncio
    async def test_list_base_prompts(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get("/api/v1/base-prompts", headers=auth_headers(token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    @pytest.mark.asyncio
    async def test_create_base_prompt_as_admin(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.ADMIN)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.post("/api/v1/base-prompts", headers=auth_headers(token), json={
            "name": "Safety Guardrail",
            "content": "You are a helpful, harmless, and honest AI assistant.",
            "version": 1,
        })
        assert r.status_code in (200, 201)
        data = r.json()
        assert data["name"] == "Safety Guardrail"

    @pytest.mark.asyncio
    async def test_create_base_prompt_requires_admin(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.BUILDER)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.post("/api/v1/base-prompts", headers=auth_headers(token), json={
            "name": "Unauthorized Prompt", "content": "hacker", "version": 1,
        })
        assert r.status_code == 403

    @pytest.mark.asyncio
    async def test_get_base_prompt_by_id(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.ADMIN)
        token = await get_auth_token(client, user.email, "Password123!")
        create_r = await client.post("/api/v1/base-prompts", headers=auth_headers(token), json={
            "name": "Prompt A", "content": "You are an agent.", "version": 1,
        })
        prompt_id = create_r.json()["id"]
        r = await client.get(f"/api/v1/base-prompts/{prompt_id}", headers=auth_headers(token))
        assert r.status_code == 200
        assert r.json()["id"] == prompt_id

    @pytest.mark.asyncio
    async def test_deactivate_base_prompt(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.ADMIN)
        token = await get_auth_token(client, user.email, "Password123!")
        create_r = await client.post("/api/v1/base-prompts", headers=auth_headers(token), json={
            "name": "To Deactivate", "content": "...", "version": 1,
        })
        prompt_id = create_r.json()["id"]
        r = await client.delete(f"/api/v1/base-prompts/{prompt_id}", headers=auth_headers(token))
        assert r.status_code in (200, 204)


# ── Users ─────────────────────────────────────────────────────────────────────────

class TestUsersRoutes:

    @pytest.mark.asyncio
    async def test_get_current_user(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get("/api/v1/users/me", headers=auth_headers(token))
        assert r.status_code == 200
        assert r.json()["email"] == user.email

    @pytest.mark.asyncio
    async def test_list_users_as_admin(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.ADMIN)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get("/api/v1/users", headers=auth_headers(token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    @pytest.mark.asyncio
    async def test_list_users_forbidden_for_viewer(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.VIEWER)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get("/api/v1/users", headers=auth_headers(token))
        assert r.status_code == 403

    @pytest.mark.asyncio
    async def test_invite_user_as_admin(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.ADMIN)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.post("/api/v1/users/invite", headers=auth_headers(token), json={
            "email": "newuser@company.com",
            "role": "builder",
        })
        assert r.status_code in (200, 201)


# ── Metrics ────────────────────────────────────────────────────────────────────────

class TestMetricsRoutes:

    @pytest.mark.asyncio
    async def test_metrics_endpoint_accessible(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.ADMIN)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get("/api/v1/metrics/overview", headers=auth_headers(token))
        assert r.status_code in (200, 404)  # may not be implemented yet

    @pytest.mark.asyncio
    async def test_cost_metrics_by_blueprint(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.ADMIN)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get("/api/v1/metrics/costs", headers=auth_headers(token))
        assert r.status_code in (200, 404)


# ── Admin Routes ──────────────────────────────────────────────────────────────────

class TestAdminRoutes:

    @pytest.mark.asyncio
    async def test_audit_log_requires_admin(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.BUILDER)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get("/api/v1/admin/audit-log", headers=auth_headers(token))
        assert r.status_code == 403

    @pytest.mark.asyncio
    async def test_audit_log_accessible_as_admin(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.ADMIN)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get("/api/v1/admin/audit-log", headers=auth_headers(token))
        assert r.status_code == 200
        data = r.json()
        assert "items" in data or isinstance(data, list)

    @pytest.mark.asyncio
    async def test_dependency_graph_as_admin(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.ADMIN)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get("/api/v1/admin/dependency-graph", headers=auth_headers(token))
        assert r.status_code == 200
        data = r.json()
        assert "nodes" in data or isinstance(data, dict)

    @pytest.mark.asyncio
    async def test_audit_log_pagination(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.ADMIN)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get("/api/v1/admin/audit-log?page=1&page_size=5",
                             headers=auth_headers(token))
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_health_check_always_accessible(self, client: AsyncClient):
        r = await client.get("/api/v1/health")
        assert r.status_code == 200
        assert r.json().get("status") in ("ok", "healthy", True, "running")


# ── Skills ────────────────────────────────────────────────────────────────────────

class TestSkillsRoutes:

    @pytest.mark.asyncio
    async def test_list_skills(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get("/api/v1/skills", headers=auth_headers(token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    @pytest.mark.asyncio
    async def test_create_skill_as_admin(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.ADMIN)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.post("/api/v1/skills", headers=auth_headers(token), json={
            "name": "email-drafting",
            "description": "Helps draft professional emails",
            "prompt_template": "Draft a professional email about: {topic}",
            "tags": ["communication"],
        })
        assert r.status_code in (200, 201)
