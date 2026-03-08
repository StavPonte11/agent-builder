"""
test_unit_blueprint_service.py — Unit tests for BlueprintService.
Tests validation logic, cost estimation, duplicate, rollback without HTTP.
"""
from __future__ import annotations

import uuid
from copy import deepcopy
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from fastapi import HTTPException

from app.models.blueprint import Blueprint, BlueprintStatus, BlueprintType, BlueprintVersion
from app.models.user import UserRole
from app.schemas.blueprint import (
    BlueprintCreate,
    BlueprintDuplicateRequest,
    BlueprintRollbackRequest,
    BlueprintUpdate,
)
from app.services.blueprint_service import BlueprintService, _MODEL_COST_MAP

pytestmark = pytest.mark.unit


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_definition(**overrides) -> dict:
    base = {
        "nodes": [
            {"id": "t1", "type": "trigger", "label": "T", "data": {}},
            {"id": "l1", "type": "llm",     "label": "L", "data": {"model": "gpt-4o", "max_tokens": 500, "system_prompt": "x" * 400}},
            {"id": "o1", "type": "output",  "label": "O", "data": {}},
        ],
        "edges": [
            {"id": "e1", "source": "t1", "target": "l1"},
            {"id": "e2", "source": "l1", "target": "o1"},
        ],
    }
    base.update(overrides)
    return base


def _make_service(db, user, org, role=UserRole.BUILDER) -> BlueprintService:
    mock_user = MagicMock()
    mock_user.id     = user.id
    mock_user.org_id = org.id
    mock_user.role   = role
    return BlueprintService(db=db, user=mock_user)


# ── Validate ──────────────────────────────────────────────────────────────────────

class TestBlueprintValidation:

    @pytest.mark.asyncio
    async def test_valid_blueprint_returns_no_errors(self, db_session):
        from tests.conftest import create_blueprint, create_user_and_org
        user, org = await create_user_and_org(db_session)
        bp = await create_blueprint(db_session, user, org)
        svc = _make_service(db_session, user, org)
        result = await svc.validate(bp.id)
        assert result.valid is True
        assert result.errors == []

    @pytest.mark.asyncio
    async def test_empty_nodes_produces_error(self, db_session):
        from tests.conftest import create_user_and_org
        user, org = await create_user_and_org(db_session)
        bp = Blueprint(
            org_id=org.id, created_by=user.id,
            name="Empty", blueprint_type=BlueprintType.WORKFLOW,
            definition={"nodes": [], "edges": []},
        )
        db_session.add(bp)
        await db_session.flush()
        svc = _make_service(db_session, user, org)
        result = await svc.validate(bp.id)
        assert result.valid is False
        assert any("no nodes" in e.lower() for e in result.errors)

    @pytest.mark.asyncio
    async def test_missing_trigger_produces_error(self, db_session):
        from tests.conftest import create_user_and_org
        user, org = await create_user_and_org(db_session)
        bp = Blueprint(
            org_id=org.id, created_by=user.id,
            name="No trigger", blueprint_type=BlueprintType.WORKFLOW,
            definition={
                "nodes": [{"id": "l1", "type": "llm", "data": {}}],
                "edges": [],
            },
        )
        db_session.add(bp)
        await db_session.flush()
        svc = _make_service(db_session, user, org)
        result = await svc.validate(bp.id)
        assert result.valid is False
        assert any("trigger" in e.lower() for e in result.errors)

    @pytest.mark.asyncio
    async def test_disconnected_node_produces_warning(self, db_session):
        from tests.conftest import create_user_and_org
        user, org = await create_user_and_org(db_session)
        defn = {
            "nodes": [
                {"id": "t1", "type": "trigger", "data": {}},
                {"id": "orphan", "type": "llm", "data": {}},  # disconnected
            ],
            "edges": [],
        }
        bp = Blueprint(
            org_id=org.id, created_by=user.id,
            name="Disconnected", blueprint_type=BlueprintType.WORKFLOW,
            definition=defn,
        )
        db_session.add(bp)
        await db_session.flush()
        svc = _make_service(db_session, user, org)
        result = await svc.validate(bp.id)
        assert any("disconnected" in w.lower() or "orphan" in w.lower() for w in result.warnings)

    @pytest.mark.asyncio
    async def test_missing_output_node_produces_warning(self, db_session):
        from tests.conftest import create_user_and_org
        user, org = await create_user_and_org(db_session)
        bp = Blueprint(
            org_id=org.id, created_by=user.id,
            name="No output", blueprint_type=BlueprintType.WORKFLOW,
            definition={
                "nodes": [
                    {"id": "t1", "type": "trigger", "data": {}},
                    {"id": "l1", "type": "llm",     "data": {}},
                ],
                "edges": [{"id": "e1", "source": "t1", "target": "l1"}],
            },
        )
        db_session.add(bp)
        await db_session.flush()
        svc = _make_service(db_session, user, org)
        result = await svc.validate(bp.id)
        assert any("output" in w.lower() for w in result.warnings)


# ── Cost Estimate ─────────────────────────────────────────────────────────────────

class TestCostEstimate:

    @pytest.mark.asyncio
    async def test_no_llm_nodes_returns_zero_cost(self, db_session):
        from tests.conftest import create_user_and_org
        user, org = await create_user_and_org(db_session)
        bp = Blueprint(
            org_id=org.id, created_by=user.id,
            name="No LLM", blueprint_type=BlueprintType.WORKFLOW,
            definition={"nodes": [{"id": "t1", "type": "trigger", "data": {}}], "edges": []},
        )
        db_session.add(bp)
        await db_session.flush()
        svc = _make_service(db_session, user, org)
        estimate = await svc.estimate_cost(bp.id)
        assert estimate.estimated_cost_usd_per_run == 0.0
        assert estimate.estimated_tokens_per_run == 0

    @pytest.mark.asyncio
    async def test_gpt4o_llm_node_calculates_correctly(self, db_session):
        from tests.conftest import create_user_and_org
        user, org = await create_user_and_org(db_session)
        system_prompt = "A" * 4000  # 4000 chars ≈ 1000 tokens
        max_tokens = 500
        bp = Blueprint(
            org_id=org.id, created_by=user.id,
            name="With LLM", blueprint_type=BlueprintType.WORKFLOW,
            definition={
                "nodes": [
                    {"id": "l1", "type": "llm", "data": {
                        "model": "gpt-4o",
                        "system_prompt": system_prompt,
                        "max_tokens": max_tokens,
                    }},
                ],
                "edges": [],
            },
        )
        db_session.add(bp)
        await db_session.flush()
        svc = _make_service(db_session, user, org)
        estimate = await svc.estimate_cost(bp.id)
        expected_tokens = (len(system_prompt) // 4) + max_tokens  # 1000 + 500 = 1500
        cost_per_k = _MODEL_COST_MAP["gpt-4o"]
        expected_cost = (expected_tokens / 1000.0) * cost_per_k
        assert estimate.estimated_tokens_per_run == expected_tokens
        assert abs(estimate.estimated_cost_usd_per_run - expected_cost) < 0.0001
        assert len(estimate.model_breakdown) == 1
        assert estimate.model_breakdown[0]["model"] == "gpt-4o"

    @pytest.mark.asyncio
    async def test_multiple_llm_nodes_accumulate(self, db_session):
        from tests.conftest import create_user_and_org
        user, org = await create_user_and_org(db_session)
        bp = Blueprint(
            org_id=org.id, created_by=user.id,
            name="Multi LLM", blueprint_type=BlueprintType.WORKFLOW,
            definition={
                "nodes": [
                    {"id": "l1", "type": "llm", "data": {"model": "gpt-4o-mini", "max_tokens": 200, "system_prompt": ""}},
                    {"id": "l2", "type": "llm", "data": {"model": "gpt-4o",      "max_tokens": 400, "system_prompt": ""}},
                ],
                "edges": [],
            },
        )
        db_session.add(bp)
        await db_session.flush()
        svc = _make_service(db_session, user, org)
        estimate = await svc.estimate_cost(bp.id)
        assert len(estimate.model_breakdown) == 2
        assert estimate.estimated_tokens_per_run > 0

    @pytest.mark.asyncio
    async def test_unknown_model_uses_default_rate(self, db_session):
        from tests.conftest import create_user_and_org
        user, org = await create_user_and_org(db_session)
        bp = Blueprint(
            org_id=org.id, created_by=user.id,
            name="Unknown model", blueprint_type=BlueprintType.WORKFLOW,
            definition={
                "nodes": [{"id": "l1", "type": "llm", "data": {"model": "llama-99", "max_tokens": 100, "system_prompt": ""}}],
                "edges": [],
            },
        )
        db_session.add(bp)
        await db_session.flush()
        svc = _make_service(db_session, user, org)
        estimate = await svc.estimate_cost(bp.id)
        assert estimate.estimated_cost_usd_per_run > 0  # defaults to "default" rate


# ── Duplicate ─────────────────────────────────────────────────────────────────────

class TestBlueprintDuplicate:

    @pytest.mark.asyncio
    async def test_duplicate_creates_new_blueprint(self, db_session):
        from tests.conftest import create_blueprint, create_user_and_org
        user, org = await create_user_and_org(db_session)
        bp = await create_blueprint(db_session, user, org)
        svc = _make_service(db_session, user, org)
        copy = await svc.duplicate(bp.id, BlueprintDuplicateRequest(name="Copy of Test"))
        assert copy.id != bp.id
        assert copy.name == "Copy of Test"
        assert copy.parent_id == bp.id
        assert copy.status == BlueprintStatus.DRAFT
        assert copy.version == 1

    @pytest.mark.asyncio
    async def test_duplicate_preserves_definition(self, db_session):
        from tests.conftest import create_blueprint, create_user_and_org
        user, org = await create_user_and_org(db_session)
        bp = await create_blueprint(db_session, user, org)
        svc = _make_service(db_session, user, org)
        copy = await svc.duplicate(bp.id, BlueprintDuplicateRequest(name="Copy"))
        assert copy.definition == bp.definition

    @pytest.mark.asyncio
    async def test_duplicate_definition_is_deep_copy(self, db_session):
        from tests.conftest import create_blueprint, create_user_and_org
        user, org = await create_user_and_org(db_session)
        bp = await create_blueprint(db_session, user, org)
        svc = _make_service(db_session, user, org)
        copy = await svc.duplicate(bp.id, BlueprintDuplicateRequest(name="Copy"))
        # Mutating copy definition shouldn't affect original
        copy.definition["nodes"].append({"id": "new", "type": "test", "data": {}})
        assert len(bp.definition["nodes"]) == 3  # still 3 (trigger + llm + output)


# ── Update ────────────────────────────────────────────────────────────────────────

class TestBlueprintUpdate:

    @pytest.mark.asyncio
    async def test_update_draft_blueprint(self, db_session):
        from tests.conftest import create_blueprint, create_user_and_org
        user, org = await create_user_and_org(db_session)
        bp = await create_blueprint(db_session, user, org)
        svc = _make_service(db_session, user, org)
        updated = await svc.update(bp.id, BlueprintUpdate(name="Updated Name"))
        assert updated.name == "Updated Name"

    @pytest.mark.asyncio
    async def test_update_published_blueprint_raises(self, db_session):
        from tests.conftest import create_blueprint, create_user_and_org
        user, org = await create_user_and_org(db_session)
        bp = await create_blueprint(db_session, user, org, status=BlueprintStatus.PUBLISHED)
        svc = _make_service(db_session, user, org)
        with pytest.raises(HTTPException) as exc:
            await svc.update(bp.id, BlueprintUpdate(name="Illegal"))
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_update_nonexistent_blueprint_raises_404(self, db_session):
        from tests.conftest import create_user_and_org
        user, org = await create_user_and_org(db_session)
        svc = _make_service(db_session, user, org)
        with pytest.raises(HTTPException) as exc:
            await svc.update(uuid.uuid4(), BlueprintUpdate(name="Ghost"))
        assert exc.value.status_code == 404


# ── Delete ────────────────────────────────────────────────────────────────────────

class TestBlueprintDelete:

    @pytest.mark.asyncio
    async def test_soft_delete_sets_flag(self, db_session):
        from tests.conftest import create_blueprint, create_user_and_org
        user, org = await create_user_and_org(db_session)
        bp = await create_blueprint(db_session, user, org)
        svc = _make_service(db_session, user, org)
        await svc.delete(bp.id)
        assert bp.is_deleted is True

    @pytest.mark.asyncio
    async def test_deleted_blueprint_not_in_list(self, db_session):
        from tests.conftest import create_blueprint, create_user_and_org
        user, org = await create_user_and_org(db_session)
        bp = await create_blueprint(db_session, user, org)
        svc = _make_service(db_session, user, org)
        await svc.delete(bp.id)
        items = await svc.list()
        assert bp.id not in [b.id for b in items]


# ── Rollback ──────────────────────────────────────────────────────────────────────

class TestBlueprintRollback:

    @pytest.mark.asyncio
    async def test_rollback_restores_definition(self, db_session):
        from tests.conftest import create_blueprint, create_user_and_org
        user, org = await create_user_and_org(db_session)
        admin_user, _ = await create_user_and_org(db_session, role=UserRole.ADMIN)
        admin_user.org_id = org.id
        await db_session.flush()

        bp = await create_blueprint(db_session, user, org)
        old_defn = deepcopy(bp.definition)

        # Create a version snapshot
        ver = BlueprintVersion(
            blueprint_id=bp.id,
            version=1,
            definition=old_defn,
            published_by=user.id,
            release_notes="v1",
        )
        db_session.add(ver)
        await db_session.flush()

        # Mutate the blueprint
        bp.definition = {"nodes": [], "edges": []}
        await db_session.flush()

        # Rollback as admin
        svc = _make_service(db_session, admin_user, org, role=UserRole.ADMIN)
        rolled = await svc.rollback(bp.id, BlueprintRollbackRequest(version=1))
        assert rolled.definition == old_defn
        assert rolled.version == 2
        assert rolled.status == BlueprintStatus.DRAFT

    @pytest.mark.asyncio
    async def test_rollback_to_nonexistent_version_raises(self, db_session):
        from tests.conftest import create_blueprint, create_user_and_org
        user, org = await create_user_and_org(db_session, role=UserRole.ADMIN)
        bp = await create_blueprint(db_session, user, org)
        svc = _make_service(db_session, user, org, role=UserRole.ADMIN)
        with pytest.raises(HTTPException) as exc:
            await svc.rollback(bp.id, BlueprintRollbackRequest(version=99))
        assert exc.value.status_code == 404
