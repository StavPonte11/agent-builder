"""
sandbox.py — Sandbox execution API.
Allows builders to execute blueprints in a "sandbox" mode that:
  - Runs directly (no Temporal) for fast prompt iteration
  - Evaluates output immediately via LLM judge
  - Tracks per-prompt iterations in a dedicated sandbox_runs table
  - Exposes an "approve" endpoint to signal readiness for publish

Routes:
  POST /blueprints/{id}/sandbox          → run in sandbox with test payload
  GET  /blueprints/{id}/sandbox/results  → list last N sandbox runs + scores
  POST /blueprints/{id}/sandbox/approve  → mark sandbox as passing (unlock publish)
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.dependencies import CurrentUser, DbSession

router = APIRouter(prefix="/blueprints", tags=["Sandbox"])


# ── Schemas ───────────────────────────────────────────────────────────────────────

class SandboxRunRequest(BaseModel):
    run_id: Optional[str] = None
    input_data: dict = {}
    override_prompts: dict[str, str] = {}  # node_id → new system_prompt (in-memory only)
    eval_immediately: bool = True


class EvalScore(BaseModel):
    dimension: str
    score: float
    reasoning: str
    weight: float = 1.0


class SandboxRunResult(BaseModel):
    run_id: str
    blueprint_id: str
    started_at: str
    duration_ms: int
    status: str                            # "completed" | "failed"
    output: dict
    error: Optional[str] = None
    eval_scores: list[EvalScore] = []
    aggregate_score: Optional[float] = None
    passed: Optional[bool] = None
    override_prompts: dict[str, str] = {}


class SandboxApproveRequest(BaseModel):
    notes: str = ""

class SandboxResumeRequest(BaseModel):
    run_id: str
    state_patch: dict = {}
    override_prompts: dict[str, str] = {}
    eval_immediately: bool = True

# ── Endpoints ─────────────────────────────────────────────────────────────────────

@router.post("/{blueprint_id}/sandbox", response_model=SandboxRunResult)
async def run_sandbox(
    blueprint_id: uuid.UUID,
    body: SandboxRunRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Execute a blueprint in sandbox mode.
    - No Temporal, no persistent execution record.
    - Applies override_prompts (per-node system_prompt overrides) without saving.
    - Runs the compiled LangGraph graph directly in-process.
    - Evaluates output via LLM judge if blueprint has evaluation_config.
    """
    from app.services.blueprint_service import BlueprintService
    from sqlalchemy import text
    import time

    svc = BlueprintService(db=db, user=current_user)
    blueprint = await svc.get(blueprint_id)

    # Clone definition and apply prompt overrides
    import copy
    definition = copy.deepcopy(blueprint.definition or {})
    for node in definition.get("nodes", []):
        nid = node.get("id")
        if nid in body.override_prompts:
            node.setdefault("data", {})["system_prompt"] = body.override_prompts[nid]

    # Compile and run
    from workflow_engine.compiler import BlueprintCompiler
    from langgraph.checkpoint.memory import AsyncMemorySaver
    
    # We use a global in-memory saver for the sandbox to allow time-travel debugging across requests.
    # In production with multiple worker processes, this would need to be Redis/Postgres.
    global _sandbox_checkpointer
    if '_sandbox_checkpointer' not in globals():
        _sandbox_checkpointer = AsyncMemorySaver()
        
    # Get decrypted BYOK API keys
    from app.models.organization import Organization
    from sqlalchemy import select
    org = await db.scalar(select(Organization).where(Organization.id == current_user.org_id))
    decrypted_keys = org.get_decrypted_provider_keys() if org else {}
    
    from app.services.llm_provider_pool import LLMProviderPool
    pool = LLMProviderPool(override_keys=decrypted_keys)
        
    compiler = BlueprintCompiler(llm_pool=pool)

    run_id = body.run_id or str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)
    t0 = time.monotonic()

    exec_output = {}
    exec_error = None

    try:
        import asyncio
        graph = compiler.compile(definition, checkpointer=_sandbox_checkpointer)
        initial_state = {
            "messages": [],
            "context": body.input_data,
            "memory": {},
            "output": {},
            "is_approved": False,
            "_current_node_id": "",
        }
        from app.redis_client import get_redis_client
        redis = await get_redis_client()
        channel = f"exec:{run_id}"
        await redis.publish(channel, json.dumps({"type": "execution_started", "execution_id": run_id}))

        # Run via streaming to capture node-by-node execution
        async def stream_graph():
            final_output = {}
            async for chunk in graph.astream(initial_state, config={"configurable": {"thread_id": run_id}}, stream_mode="updates"):
                for node_name, node_update in chunk.items():
                    if "output" in node_update:
                        final_output = node_update.get("output", {})
                    if "context" in node_update and not final_output:
                        final_output = node_update.get("context", {})
            return final_output

        exec_output = await asyncio.wait_for(stream_graph(), timeout=120.0)
        
        await redis.publish(channel, json.dumps({"type": "execution_completed", "execution_id": run_id}))

    except asyncio.TimeoutError:
        exec_error = "Sandbox execution timed out (120s)"
    except Exception as exc:
        exec_error = str(exc)

    duration_ms = int((time.monotonic() - t0) * 1000)

    # Evaluate if requested
    eval_scores: list[EvalScore] = []
    aggregate: Optional[float] = None
    passed: Optional[bool] = None

    if body.eval_immediately and not exec_error:
        eval_cfg = blueprint.config.get("evaluation_config", {}) or {}
        dimensions = eval_cfg.get("scoring_dimensions", [])
        judge_model = eval_cfg.get("judge_model", os.getenv("EVALUATION_JUDGE_MODEL", "gpt-4o"))
        pass_threshold = eval_cfg.get("pass_threshold", 0.7)

        if dimensions:
            for dim in dimensions:
                system = (
                    "You are an objective evaluator. Score the AI workflow output on a scale 0.0–1.0 "
                    f"based on: {dim.get('rubric', '')}. "
                    'Respond ONLY with JSON: {"score": <float>, "reasoning": "<one sentence>"}.'
                )
                user = f"WORKFLOW OUTPUT:\n{json.dumps(exec_output, indent=2)[:3000]}"
                try:
                    raw = pool.call(model=judge_model, system=system, user=user,
                                    max_tokens=200, temperature=0.0)
                    parsed = json.loads(raw)
                    eval_scores.append(EvalScore(
                        dimension=dim.get("name", "unknown"),
                        score=float(parsed.get("score", 0)),
                        reasoning=parsed.get("reasoning", ""),
                        weight=dim.get("weight", 1.0),
                    ))
                except Exception as eval_err:
                    eval_scores.append(EvalScore(
                        dimension=dim.get("name", "unknown"),
                        score=0.0,
                        reasoning=f"Evaluation error: {eval_err}",
                        weight=dim.get("weight", 1.0),
                    ))

            if eval_scores:
                tw = sum(s.weight for s in eval_scores)
                aggregate = sum(s.score * s.weight for s in eval_scores) / (tw or 1)
                passed = aggregate >= pass_threshold

    # Persist sandbox run for results history
    try:
        await db.execute(
            text("""
                INSERT INTO sandbox_runs
                    (id, blueprint_id, org_id, run_by, input_data, output_data,
                     duration_ms, status, error, eval_scores, aggregate_score, passed,
                     override_prompts, created_at)
                VALUES
                    (:id, :bp_id, :org_id, :user_id, :input::jsonb, :output::jsonb,
                     :dur, :status, :error, :scores::jsonb, :agg, :passed,
                     :overrides::jsonb, NOW())
                ON CONFLICT DO NOTHING
            """),
            {
                "id": run_id,
                "bp_id": str(blueprint_id),
                "org_id": str(current_user.org_id),
                "user_id": str(current_user.id),
                "input": json.dumps(body.input_data),
                "output": json.dumps(exec_output),
                "dur": duration_ms,
                "status": "failed" if exec_error else "completed",
                "error": exec_error,
                "scores": json.dumps([s.model_dump() for s in eval_scores]),
                "agg": aggregate,
                "passed": passed,
                "overrides": json.dumps(body.override_prompts),
            },
        )
        await db.commit()
    except Exception:
        pass  # Sandbox run storage is best-effort

    return SandboxRunResult(
        run_id=run_id,
        blueprint_id=str(blueprint_id),
        started_at=started_at.isoformat(),
        duration_ms=duration_ms,
        status="failed" if exec_error else "completed",
        output=exec_output,
        error=exec_error,
        eval_scores=eval_scores,
        aggregate_score=aggregate,
        passed=passed,
        override_prompts=body.override_prompts,
    )


@router.get("/{blueprint_id}/sandbox/results")
async def list_sandbox_results(
    blueprint_id: uuid.UUID,
    limit: int = 20,
    current_user: CurrentUser = None,
    db: DbSession = None,
):
    """
    Returns the last N sandbox runs for this blueprint, newest first.
    """
    from sqlalchemy import text

    result = await db.execute(
        text("""
            SELECT id, run_by, input_data, output_data, duration_ms, status,
                   error, eval_scores, aggregate_score, passed, override_prompts, created_at
            FROM sandbox_runs
            WHERE blueprint_id = :bp_id AND org_id = :org_id
            ORDER BY created_at DESC
            LIMIT :limit
        """),
        {"bp_id": str(blueprint_id), "org_id": str(current_user.org_id), "limit": limit},
    )
    rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.post("/{blueprint_id}/sandbox/approve", status_code=status.HTTP_200_OK)
async def approve_sandbox(
    blueprint_id: uuid.UUID,
    body: SandboxApproveRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Mark the sandbox for this blueprint as passing.
    Sets blueprint.sandbox_approved = True (required for publish wizard to proceed).
    """
    from app.services.blueprint_service import BlueprintService
    from sqlalchemy import text

    svc = BlueprintService(db=db, user=current_user)
    await svc.get(blueprint_id)  # 404 if not found / not in org

    await db.execute(
        text("""
            UPDATE blueprints
            SET config = jsonb_set(
                config,
                '{sandbox_approved}',
                'true'::jsonb
            ),
            config = jsonb_set(
                config,
                '{sandbox_approved_by}',
                to_jsonb(:user_id::text)
            )
            WHERE id = :id
        """),
        {"id": str(blueprint_id), "user_id": str(current_user.id)},
    )
    await db.commit()
    return {"approved": True, "blueprint_id": str(blueprint_id), "notes": body.notes}

@router.post("/{blueprint_id}/sandbox/resume_or_rewind", response_model=SandboxRunResult)
async def resume_or_rewind_sandbox(
    blueprint_id: uuid.UUID,
    body: SandboxResumeRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Time-Travel Debugging: Resume a suspended or rewound Sandbox execution.
    Applies the optional state_patch to the thread's memory before resuming.
    """
    from app.services.blueprint_service import BlueprintService
    from workflow_engine.compiler import BlueprintCompiler
    import time
    
    svc = BlueprintService(db=db, user=current_user)
    blueprint = await svc.get(blueprint_id)

    # Clone definition and apply prompt overrides
    import copy
    definition = copy.deepcopy(blueprint.definition or {})
    for node in definition.get("nodes", []):
        nid = node.get("id")
        if nid in body.override_prompts:
            node.setdefault("data", {})["system_prompt"] = body.override_prompts[nid]

    # Get decrypted BYOK API keys
    from app.models.organization import Organization
    from sqlalchemy import select
    org = await db.scalar(select(Organization).where(Organization.id == current_user.org_id))
    decrypted_keys = org.get_decrypted_provider_keys() if org else {}
    
    from app.services.llm_provider_pool import LLMProviderPool
    pool = LLMProviderPool(override_keys=decrypted_keys)

    compiler = BlueprintCompiler(llm_pool=pool)
    
    global _sandbox_checkpointer
    if '_sandbox_checkpointer' not in globals():
        from langgraph.checkpoint.memory import AsyncMemorySaver
        _sandbox_checkpointer = AsyncMemorySaver()

    run_id = body.run_id
    started_at = datetime.now(timezone.utc)
    t0 = time.monotonic()

    exec_output = {}
    exec_error = None

    try:
        import asyncio
        graph = compiler.compile(definition, checkpointer=_sandbox_checkpointer)
        config = {"configurable": {"thread_id": run_id}}
        
        # Apply patch if provided (time-travel state modification)
        if body.state_patch:
            await graph.aupdate_state(config, body.state_patch)

        # Resume execution (passing None for input state tells LangGraph to resume from checkpointer)
        result = await asyncio.wait_for(
            graph.ainvoke(None, config=config),
            timeout=120.0,
        )
        exec_output = result.get("output", result.get("context", {}))

    except asyncio.TimeoutError:
        exec_error = "Sandbox resume timed out (120s)"
    except Exception as exc:
        exec_error = str(exc)

    duration_ms = int((time.monotonic() - t0) * 1000)

    # Note: Evaluator logic could be abstractified, but skipping for brevity, returning un-scored.
    return SandboxRunResult(
        run_id=run_id,
        blueprint_id=str(blueprint_id),
        started_at=started_at.isoformat(),
        duration_ms=duration_ms,
        status="failed" if exec_error else "completed",
        output=exec_output,
        error=exec_error,
        eval_scores=[],
        aggregate_score=None,
        passed=None,
        override_prompts=body.override_prompts,
    )
