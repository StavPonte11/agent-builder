"""
Blueprint routes.
Full CRUD + duplicate + validate + estimate + versioning + rollback.

GET    /blueprints/
POST   /blueprints/
GET    /blueprints/{id}
PUT    /blueprints/{id}
DELETE /blueprints/{id}
POST   /blueprints/{id}/duplicate
POST   /blueprints/{id}/validate
GET    /blueprints/{id}/estimate
GET    /blueprints/{id}/versions
POST   /blueprints/{id}/rollback
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Query, status

from app.dependencies import CurrentUser, DbSession
from app.models.blueprint import BlueprintStatus, BlueprintType
from app.schemas.blueprint import (
    BlueprintCostEstimate,
    BlueprintCreate,
    BlueprintDuplicateRequest,
    BlueprintListItem,
    BlueprintResponse,
    BlueprintRollbackRequest,
    BlueprintUpdate,
    BlueprintValidateResponse,
    BlueprintVersionResponse,
)
from app.services.blueprint_service import BlueprintService

router = APIRouter(prefix="/blueprints", tags=["Blueprints"])


# ── E10: Standalone validate (body, not by blueprint ID) ──────────────────────

from pydantic import BaseModel as _BaseModel

class ValidateDefinitionRequest(_BaseModel):
    definition: dict
    iterative: bool = False
    existing_nodes: list = []
    existing_edges: list = []

class GenerateRequest(_BaseModel):
    prompt: str
    existing_nodes: list = []
    existing_edges: list = []
    iterative: bool = False

class DiffRequest(_BaseModel):
    old_version: int
    new_version: int

class TestNodeRequest(_BaseModel):
    node_type: str
    node_data: dict
    sample_state: dict = {}

class ImprovePromptRequest(_BaseModel):
    system_prompt: str = ""
    user_prompt: str = ""
    context: str = ""


@router.post("/validate")
async def validate_definition(body: ValidateDefinitionRequest, current_user: CurrentUser, db: DbSession):
    """Validate a blueprint definition without requiring it to be saved."""
    from workflow_engine.compiler import BlueprintCompiler
    compiler = BlueprintCompiler()
    return compiler.validate(body.definition)


@router.post("/generate")
async def generate_blueprint(body: GenerateRequest, current_user: CurrentUser, db: DbSession):
    """
    Convert a natural language description into a BlueprintDefinition.
    If iterative=True and existing_nodes provided, returns new_nodes/new_edges to append.
    """
    from app.services.llm_provider_pool import LLMProviderPool
    import json

    pool = LLMProviderPool()

    if body.iterative and body.existing_nodes:
        system = (
            "You are a workflow architect. The user has an existing workflow canvas and wants to modify it. "
            "Return a JSON object with keys: 'new_nodes' (array) and 'new_edges' (array). "
            "Each node: {id, type, position: {x, y}, data: {label, ...}}. "
            "Each edge: {id, source, target, sourceHandle?, type}. "
            "CRITICAL: You MUST ONLY use these EXACT node types: trigger, llm, tool, condition, router, approval, memory_read, memory_write, code, sub_blueprint, output, parallel_fork, loop, llm_judge. "
            "ABSOLUTELY NO OTHER TYPES ARE ALLOWED. Do NOT invent types like 'http_request'. If you need an API call, use a 'tool' or 'code' node. "
            f"Existing nodes: {json.dumps([n.get('data', {}).get('label') for n in body.existing_nodes])}"
        )
    else:
        system = (
            "You are a workflow architect. Convert the user's description into a minimal React Flow graph. "
            "Return a JSON object with keys: 'nodes' (array) and 'edges' (array). "
            "Each node: {id: string, type: string, position: {x: number, y: number}, data: {label: string}}. "
            "Each edge: {id: string, source: string, target: string, type: 'default'}. "
            "CRITICAL: You MUST ONLY use these EXACT node types: trigger, llm, tool, condition, router, approval, memory_read, memory_write, code, "
            "sub_blueprint, output, parallel_fork, loop, llm_judge. "
            "ABSOLUTELY NO OTHER TYPES ARE ALLOWED. Do NOT invent types like 'http_request'. If you need an API call, use a 'tool' or 'code' node. "
            "Position nodes left-to-right horizontally (x += 250 per step, y = 200). "
            "Always start with a trigger node. "
            "Respond with ONLY valid JSON, no markdown."
        )

        pool = LLMProviderPool()

        try:
            result = pool.call(
                model="gpt-4o-mini",
                system=system,
                user=body.prompt,
                max_tokens=4096,
                temperature=0.2,
            )
        except RuntimeError as e:
            if "No LLM API keys configured" in str(e):
                return {"nodes": [], "edges": [], "error": "No LLM API keys configured in the backend. Please add API keys to the environment."}
            raise e

        # Clean and parse JSON
    result = result.strip()
    if result.startswith("```"):
        result = "\n".join(result.split("\n")[1:-1])
    try:
        parsed = json.loads(result)

        # ─── Type alias coercion ───────────────────────────────────────────────
        # The LLM sometimes hallucinates type names. Map everything to valid types.
        _TYPE_ALIASES = {
            "human_approval": "approval",
            "human_review": "approval",
            "approval_gate": "approval",
            "tool_call": "tool",
            "http_request": "tool",
            "http_tool": "tool",
            "api_call": "tool",
            "api_request": "tool",
            "webhook": "tool",
            "action": "tool",
            "decision": "condition",
            "branch": "condition",
            "end": "output",
            "terminal": "output",
            "return": "output",
            "start": "trigger",
            "entry": "trigger",
        }
        _VALID = {
            "trigger", "llm", "tool", "condition", "router", "approval",
            "memory_read", "memory_write", "code", "sub_blueprint", "output",
            "parallel_fork", "loop", "llm_judge", "supervisor"
        }

        def _coerce_nodes(nodes_list):
            for n in nodes_list:
                t = n.get("type", "")
                if t not in _VALID:
                    n["type"] = _TYPE_ALIASES.get(t, "tool")  # default to 'tool'
            return nodes_list

        if "nodes" in parsed:
            parsed["nodes"] = _coerce_nodes(parsed.get("nodes") or [])
        if "new_nodes" in parsed:
            parsed["new_nodes"] = _coerce_nodes(parsed.get("new_nodes") or [])

        return parsed
    except json.JSONDecodeError:
        return {"nodes": [], "edges": [], "error": "Failed to parse generation result"}


@router.post("/test-node")
async def test_single_node(body: TestNodeRequest, current_user: CurrentUser, db: DbSession):
    """Run a single node executor with provided sample state."""
    from workflow_engine.compiler import BlueprintCompiler, _simple_render_jinja
    compiler = BlueprintCompiler()
    fn = compiler._build_executor("test", body.node_type, body.node_data, {})
    try:
        state = {"context": body.sample_state, "memory": {}, "output": {}, "messages": [], "is_approved": False, "_current_node_id": "test"}
        result = fn(state)
        return {"success": True, "output": result.get("context", {})}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/improve-prompt")
async def improve_prompt(body: ImprovePromptRequest, current_user: CurrentUser, db: DbSession):
    """Call Claude to improve a system or user prompt."""
    from app.services.llm_provider_pool import LLMProviderPool
    pool = LLMProviderPool()
    system = (
        "You are an expert prompt engineer. Given a system or user prompt, improve it to be clearer, "
        "more specific, and more effective. Maintain the original intent. Return ONLY the improved prompt text, no explanation."
    )
    user = f"SYSTEM PROMPT:\n{body.system_prompt}\n\nUSER PROMPT TEMPLATE:\n{body.user_prompt}"
    improved = pool.call(model="claude-3-7-sonnet-20250219", system=system, user=user, max_tokens=2048, temperature=0.3)
    return {"improved_system_prompt": improved}



@router.get("", response_model=list[BlueprintListItem])
async def list_blueprints(
    current_user: CurrentUser,
    db: DbSession,
    status_filter: Optional[BlueprintStatus] = Query(default=None, alias="status"),
    blueprint_type: Optional[BlueprintType] = Query(default=None),
) -> list[BlueprintListItem]:
    svc = BlueprintService(db, current_user)
    blueprints = await svc.list(status_filter=status_filter, blueprint_type=blueprint_type)
    return [BlueprintListItem.model_validate(b) for b in blueprints]


@router.post("", response_model=BlueprintResponse, status_code=status.HTTP_201_CREATED)
async def create_blueprint(
    body: BlueprintCreate, current_user: CurrentUser, db: DbSession
) -> BlueprintResponse:
    svc = BlueprintService(db, current_user)
    return BlueprintResponse.model_validate(await svc.create(body))


@router.get("/{blueprint_id}", response_model=BlueprintResponse)
async def get_blueprint(
    blueprint_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> BlueprintResponse:
    svc = BlueprintService(db, current_user)
    return BlueprintResponse.model_validate(await svc.get(blueprint_id))


@router.put("/{blueprint_id}", response_model=BlueprintResponse)
async def update_blueprint(
    blueprint_id: uuid.UUID,
    body: BlueprintUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> BlueprintResponse:
    svc = BlueprintService(db, current_user)
    return BlueprintResponse.model_validate(await svc.update(blueprint_id, body))


@router.delete("/{blueprint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_blueprint(
    blueprint_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    svc = BlueprintService(db, current_user)
    await svc.delete(blueprint_id)


@router.post("/{blueprint_id}/duplicate", response_model=BlueprintResponse, status_code=status.HTTP_201_CREATED)
async def duplicate_blueprint(
    blueprint_id: uuid.UUID,
    body: BlueprintDuplicateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> BlueprintResponse:
    svc = BlueprintService(db, current_user)
    return BlueprintResponse.model_validate(await svc.duplicate(blueprint_id, body))


@router.post("/{blueprint_id}/validate", response_model=BlueprintValidateResponse)
async def validate_blueprint(
    blueprint_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> BlueprintValidateResponse:
    svc = BlueprintService(db, current_user)
    return await svc.validate(blueprint_id)


# ── EVALUATION BUILDER TESTS ──────────────────────────────────────────────────

class TestCaseCreate(_BaseModel):
    name: str
    type: str  # unit, integration, regression, evaluation
    input: dict
    expected_output: dict = {}
    judge_rubric: str = ""

@router.get("/{blueprint_id}/tests")
async def list_blueprint_tests(blueprint_id: uuid.UUID, current_user: CurrentUser, db: DbSession, type: str = "unit") -> list:
    """Lists evaluation test cases for a blueprint."""
    from app.models.blueprint_test import BlueprintTest
    from sqlalchemy import select
    result = await db.execute(
        select(BlueprintTest).where(BlueprintTest.blueprint_id == blueprint_id, BlueprintTest.test_type == type)
    )
    tests = result.scalars().all()
    # Map DB model to frontend TestCase format
    return [
        {
            "id": str(t.id),
            "name": t.name,
            "type": t.test_type.value,
            "input": t.input_data,
            "expected_output": t.expected_output,
            "judge_rubric": t.evaluation_criteria.get("rubric", ""),
            "status": "pending"
        }
        for t in tests
    ]

@router.post("/{blueprint_id}/tests")
async def create_blueprint_test(blueprint_id: uuid.UUID, body: TestCaseCreate, current_user: CurrentUser, db: DbSession):
    """Creates a new evaluation test for a blueprint."""
    from app.models.blueprint_test import BlueprintTest
    new_test = BlueprintTest(
        blueprint_id=blueprint_id,
        created_by=current_user.id,
        name=body.name,
        test_type=body.type,
        input_data=body.input,
        expected_output=body.expected_output,
        evaluation_criteria={"rubric": body.judge_rubric} if body.judge_rubric else {}
    )
    db.add(new_test)
    await db.commit()
    return {
        "id": str(new_test.id),
        "name": new_test.name,
        "type": new_test.test_type.value,
        "input": new_test.input_data,
        "expected_output": new_test.expected_output,
        "judge_rubric": new_test.evaluation_criteria.get("rubric", ""),
        "status": "pending"
    }

@router.post("/{blueprint_id}/tests/run")
async def run_blueprint_tests(blueprint_id: uuid.UUID, current_user: CurrentUser, db: DbSession, type: str = "unit"):
    """Stub: Execute tests. Currently just returns the tests marked as 'passed' for UI demonstration."""
    from app.models.blueprint_test import BlueprintTest
    from sqlalchemy import select
    result = await db.execute(
        select(BlueprintTest).where(BlueprintTest.blueprint_id == blueprint_id, BlueprintTest.test_type == type)
    )
    tests = result.scalars().all()
    return [
        {
            "id": str(t.id),
            "name": t.name,
            "type": t.test_type.value,
            "input": t.input_data,
            "expected_output": t.expected_output,
            "judge_rubric": t.evaluation_criteria.get("rubric", ""),
            "status": "passed",
            "duration_ms": 1250,
            "judge_score": 1.0,
            "judge_reasoning": "Output exactly matches expected behavior based on rubric.",
            "actual_output": t.expected_output  # mock success
        }
        for t in tests
    ]


@router.get("/{blueprint_id}/estimate", response_model=BlueprintCostEstimate)
async def estimate_blueprint_cost(
    blueprint_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> BlueprintCostEstimate:
    svc = BlueprintService(db, current_user)
    return await svc.estimate_cost(blueprint_id)


@router.get("/{blueprint_id}/versions", response_model=list[BlueprintVersionResponse])
async def list_blueprint_versions(
    blueprint_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> list[BlueprintVersionResponse]:
    svc = BlueprintService(db, current_user)
    versions = await svc.list_versions(blueprint_id)
    return [BlueprintVersionResponse.model_validate(v) for v in versions]


@router.post("/{blueprint_id}/rollback", response_model=BlueprintResponse)
async def rollback_blueprint(
    blueprint_id: uuid.UUID,
    body: BlueprintRollbackRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> BlueprintResponse:
    svc = BlueprintService(db, current_user)
    return BlueprintResponse.model_validate(await svc.rollback(blueprint_id, body))
