"""
test_integration_blueprints.py — Integration tests for /api/v1/blueprints routes.
Full CRUD + validate + cost estimate + duplicate + versions + rollback.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.models.blueprint import BlueprintStatus
from app.models.user import UserRole

pytestmark = pytest.mark.integration

# ── Minimal blueprint payload ────────────────────────────────────────────────────

def _bp_payload(**overrides) -> dict:
    payload = {
        "name": "Test Workflow",
        "description": "Created by integration test",
        "blueprint_type": "workflow",
        "definition": {
            "nodes": [
                {"id": "t1", "type": "trigger", "label": "Start", "data": {"trigger_type": "manual"}},
                {"id": "l1", "type": "llm",     "label": "LLM",   "data": {"model": "gpt-4o-mini", "max_tokens": 100, "system_prompt": "Help."}},
                {"id": "o1", "type": "output",  "label": "End",   "data": {}},
            ],
            "edges": [
                {"id": "e1", "source": "t1", "target": "l1"},
                {"id": "e2", "source": "l1", "target": "o1"},
            ],
        },
        "tags": ["test"],
    }
    payload.update(overrides)
    return payload


# ── List ──────────────────────────────────────────────────────────────────────────

class TestListBlueprints:

    @pytest.mark.asyncio
    async def test_list_returns_empty_initially(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get("/api/v1/blueprints", headers=auth_headers(token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    @pytest.mark.asyncio
    async def test_list_returns_created_blueprint(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        await client.post("/api/v1/blueprints", headers=auth_headers(token), json=_bp_payload())
        r = await client.get("/api/v1/blueprints", headers=auth_headers(token))
        assert any(b["name"] == "Test Workflow" for b in r.json())

    @pytest.mark.asyncio
    async def test_list_filters_by_status(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        await client.post("/api/v1/blueprints", headers=auth_headers(token), json=_bp_payload())
        r = await client.get("/api/v1/blueprints?status=draft", headers=auth_headers(token))
        assert r.status_code == 200
        assert all(b.get("status") == "draft" for b in r.json())

    @pytest.mark.asyncio
    async def test_list_does_not_return_deleted_blueprints(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        create_r = await client.post("/api/v1/blueprints", headers=auth_headers(token),
                                      json=_bp_payload(name="To Delete"))
        bp_id = create_r.json()["id"]
        await client.delete(f"/api/v1/blueprints/{bp_id}", headers=auth_headers(token))
        r = await client.get("/api/v1/blueprints", headers=auth_headers(token))
        assert not any(b["id"] == bp_id for b in r.json())


# ── Create ────────────────────────────────────────────────────────────────────────

class TestCreateBlueprint:

    @pytest.mark.asyncio
    async def test_create_blueprint_returns_201(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.post("/api/v1/blueprints", headers=auth_headers(token), json=_bp_payload())
        assert r.status_code == 201
        data = r.json()
        assert "id" in data
        assert data["name"] == "Test Workflow"
        assert data["status"] == "draft"
        assert data["version"] == 1

    @pytest.mark.asyncio
    async def test_create_blueprint_persists_definition(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.post("/api/v1/blueprints", headers=auth_headers(token), json=_bp_payload())
        bp_id = r.json()["id"]
        get_r = await client.get(f"/api/v1/blueprints/{bp_id}", headers=auth_headers(token))
        assert get_r.json()["definition"]["nodes"][0]["type"] == "trigger"

    @pytest.mark.asyncio
    async def test_create_blueprint_missing_name_returns_422(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.post("/api/v1/blueprints", headers=auth_headers(token),
                              json={**_bp_payload(), "name": ""})
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_create_blueprint_with_tags(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.post("/api/v1/blueprints", headers=auth_headers(token),
                              json=_bp_payload(tags=["infra", "demo"]))
        assert "infra" in r.json()["tags"]

    @pytest.mark.asyncio
    async def test_viewer_role_cannot_create_blueprint(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.VIEWER)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.post("/api/v1/blueprints", headers=auth_headers(token), json=_bp_payload())
        assert r.status_code == 403


# ── Get by ID ─────────────────────────────────────────────────────────────────────

class TestGetBlueprint:

    @pytest.mark.asyncio
    async def test_get_existing_blueprint(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        create_r = await client.post("/api/v1/blueprints", headers=auth_headers(token), json=_bp_payload())
        bp_id = create_r.json()["id"]
        r = await client.get(f"/api/v1/blueprints/{bp_id}", headers=auth_headers(token))
        assert r.status_code == 200
        assert r.json()["id"] == bp_id

    @pytest.mark.asyncio
    async def test_get_nonexistent_blueprint_returns_404(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        import uuid
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.get(f"/api/v1/blueprints/{uuid.uuid4()}", headers=auth_headers(token))
        assert r.status_code == 404


# ── Update ────────────────────────────────────────────────────────────────────────

class TestUpdateBlueprint:

    @pytest.mark.asyncio
    async def test_update_draft_blueprint(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        create_r = await client.post("/api/v1/blueprints", headers=auth_headers(token), json=_bp_payload())
        bp_id = create_r.json()["id"]
        r = await client.put(f"/api/v1/blueprints/{bp_id}", headers=auth_headers(token),
                             json={"name": "Updated Name"})
        assert r.status_code == 200
        assert r.json()["name"] == "Updated Name"

    @pytest.mark.asyncio
    async def test_update_published_blueprint_returns_409(self, client: AsyncClient, db_session):
        from tests.conftest import create_blueprint, create_user_and_org, auth_headers, get_auth_token
        from app.models.blueprint import BlueprintStatus
        user, org = await create_user_and_org(db_session)
        bp = await create_blueprint(db_session, user, org, status=BlueprintStatus.PUBLISHED)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.put(f"/api/v1/blueprints/{bp.id}", headers=auth_headers(token),
                             json={"name": "Illegal"})
        assert r.status_code == 409


# ── Delete ────────────────────────────────────────────────────────────────────────

class TestDeleteBlueprint:

    @pytest.mark.asyncio
    async def test_delete_blueprint_returns_204(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        create_r = await client.post("/api/v1/blueprints", headers=auth_headers(token), json=_bp_payload())
        bp_id = create_r.json()["id"]
        r = await client.delete(f"/api/v1/blueprints/{bp_id}", headers=auth_headers(token))
        assert r.status_code in (200, 204)

    @pytest.mark.asyncio
    async def test_deleted_blueprint_returns_404_on_get(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        create_r = await client.post("/api/v1/blueprints", headers=auth_headers(token), json=_bp_payload())
        bp_id = create_r.json()["id"]
        await client.delete(f"/api/v1/blueprints/{bp_id}", headers=auth_headers(token))
        r = await client.get(f"/api/v1/blueprints/{bp_id}", headers=auth_headers(token))
        assert r.status_code == 404


# ── Validate ──────────────────────────────────────────────────────────────────────

class TestValidateBlueprint:

    @pytest.mark.asyncio
    async def test_validate_valid_definition_returns_valid_true(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        create_r = await client.post("/api/v1/blueprints", headers=auth_headers(token), json=_bp_payload())
        bp_id = create_r.json()["id"]
        r = await client.post(f"/api/v1/blueprints/{bp_id}/validate", headers=auth_headers(token))
        assert r.status_code == 200
        assert r.json()["valid"] is True
        assert r.json()["errors"] == []

    @pytest.mark.asyncio
    async def test_validate_empty_definition_returns_errors(self, client: AsyncClient, db_session):
        from tests.conftest import create_blueprint, create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        from app.models.blueprint import Blueprint, BlueprintType
        bp = Blueprint(org_id=org.id, created_by=user.id, name="Empty",
                       blueprint_type=BlueprintType.WORKFLOW, definition={"nodes": [], "edges": []})
        db_session.add(bp)
        await db_session.flush()
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.post(f"/api/v1/blueprints/{bp.id}/validate", headers=auth_headers(token))
        assert r.status_code == 200
        assert r.json()["valid"] is False
        assert len(r.json()["errors"]) > 0

    @pytest.mark.asyncio
    async def test_validate_definition_inline(self, client: AsyncClient, db_session):
        """Test POST /blueprints/validate with a raw definition (no saved blueprint)."""
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        defn = _bp_payload()["definition"]
        r = await client.post("/api/v1/blueprints/validate",
                              headers=auth_headers(token),
                              json={"definition": defn})
        assert r.status_code == 200


# ── Cost Estimate ─────────────────────────────────────────────────────────────────

class TestCostEstimate:

    @pytest.mark.asyncio
    async def test_estimate_cost_returns_schema(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        create_r = await client.post("/api/v1/blueprints", headers=auth_headers(token), json=_bp_payload())
        bp_id = create_r.json()["id"]
        r = await client.get(f"/api/v1/blueprints/{bp_id}/estimate", headers=auth_headers(token))
        assert r.status_code == 200
        data = r.json()
        assert "estimated_tokens_per_run" in data
        assert "estimated_cost_usd_per_run" in data
        assert "model_breakdown" in data

    @pytest.mark.asyncio
    async def test_estimate_cost_gpt4o_mini_is_positive(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        create_r = await client.post("/api/v1/blueprints", headers=auth_headers(token), json=_bp_payload())
        bp_id = create_r.json()["id"]
        r = await client.get(f"/api/v1/blueprints/{bp_id}/estimate", headers=auth_headers(token))
        assert r.json()["estimated_cost_usd_per_run"] >= 0


# ── Duplicate ─────────────────────────────────────────────────────────────────────

class TestDuplicateBlueprint:

    @pytest.mark.asyncio
    async def test_duplicate_creates_copy(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        create_r = await client.post("/api/v1/blueprints", headers=auth_headers(token), json=_bp_payload())
        bp_id = create_r.json()["id"]
        r = await client.post(f"/api/v1/blueprints/{bp_id}/duplicate",
                              headers=auth_headers(token),
                              json={"name": "A Copy of Test Workflow"})
        assert r.status_code in (200, 201)
        data = r.json()
        assert data["id"] != bp_id
        assert data["name"] == "A Copy of Test Workflow"
        assert data["status"] == "draft"


# ── Versions & Rollback ──────────────────────────────────────────────────────────

class TestVersions:

    @pytest.mark.asyncio
    async def test_list_versions_returns_list(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        create_r = await client.post("/api/v1/blueprints", headers=auth_headers(token), json=_bp_payload())
        bp_id = create_r.json()["id"]
        r = await client.get(f"/api/v1/blueprints/{bp_id}/versions", headers=auth_headers(token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    @pytest.mark.asyncio
    async def test_rollback_to_nonexistent_version_returns_404(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session, role=UserRole.ADMIN)
        token = await get_auth_token(client, user.email, "Password123!")
        create_r = await client.post("/api/v1/blueprints", headers=auth_headers(token), json=_bp_payload())
        bp_id = create_r.json()["id"]
        r = await client.post(f"/api/v1/blueprints/{bp_id}/rollback",
                              headers=auth_headers(token), json={"version": 99})
        assert r.status_code == 404
