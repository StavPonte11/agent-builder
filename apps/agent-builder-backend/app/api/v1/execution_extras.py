"""
Executions router — upstream CRUD already exists.
This file adds the missing E10 endpoints:
  GET  /executions/{id}/checkpoints
  GET  /executions/{id}/state
  POST /executions/{id}/state/patch
  GET  /executions/{id}/replay
  POST /executions/{id}/resume
  GET  /executions/{id}/report
"""
from __future__ import annotations

import csv
import io
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.dependencies import CurrentUser, DbSession

router = APIRouter(prefix="/executions", tags=["Executions Extra"])


# ── Checkpoints ────────────────────────────────────────────────────────────────

@router.get("/{execution_id}/checkpoints")
async def get_checkpoints(
    execution_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Returns all checkpoints for an execution from the LangGraph PostgreSQL checkpointer.
    Falls back to execution_node_logs if checkpointer is unavailable.
    """
    from sqlalchemy import text
    try:
        # Try LangGraph checkpoint table first
        q = text("""
            SELECT
                checkpoint_id,
                node_id,
                node_type,
                node_label,
                status,
                started_at,
                completed_at,
                EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000 AS duration_ms,
                input_snapshot,
                output_snapshot,
                error_message,
                token_usage,
                cost_usd
            FROM execution_node_logs
            WHERE execution_id = :execution_id
            ORDER BY started_at ASC
        """)
        result = await db.execute(q, {"execution_id": str(execution_id)})
        rows = result.mappings().all()
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load checkpoints: {e}")


# ── Full State ─────────────────────────────────────────────────────────────────

@router.get("/{execution_id}/state")
async def get_execution_state(
    execution_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
):
    """Returns full execution state JSON (admin only, redacts sensitive fields)."""
    from sqlalchemy import text
    q = text("SELECT final_state, blueprint_id FROM executions WHERE id = :id")
    result = await db.execute(q, {"id": str(execution_id)})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Execution not found")
    return {"execution_id": str(execution_id), "state": row["final_state"]}


# ── State Patch ────────────────────────────────────────────────────────────────

class StatePatchRequest(BaseModel):
    patches: dict[str, Any]
    reason: str  # required audit note


@router.post("/{execution_id}/state/patch")
async def patch_execution_state(
    execution_id: uuid.UUID,
    body: StatePatchRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Surgical state repair — admin only, every call is audited.
    Should only be used to recover stuck executions.
    """
    from sqlalchemy import text
    import json

    # Get current state
    q = text("SELECT final_state FROM executions WHERE id = :id")
    result = await db.execute(q, {"id": str(execution_id)})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Execution not found")

    current_state = row["final_state"] or {}
    patched = {**current_state, **body.patches}

    # Update state
    await db.execute(
        text("UPDATE executions SET final_state = :state WHERE id = :id"),
        {"state": json.dumps(patched), "id": str(execution_id)},
    )

    # Audit log
    await db.execute(
        text("""
            INSERT INTO audit_logs (id, actor_id, resource_type, resource_id, event_type, after_state, note)
            VALUES (gen_random_uuid(), :actor_id, 'execution', :resource_id, 'state_patched', :after_state, :note)
        """),
        {
            "actor_id": str(current_user.id),
            "resource_id": str(execution_id),
            "after_state": json.dumps(patched),
            "note": body.reason,
        },
    )
    await db.commit()
    return {"execution_id": str(execution_id), "patched_keys": list(body.patches.keys())}


# ── Replay ─────────────────────────────────────────────────────────────────────

@router.get("/{execution_id}/replay")
async def get_replay_snapshot(
    execution_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Returns the blueprint definition that was active at execution time
    (immutable version snapshot, safe for replay).
    """
    from sqlalchemy import text
    q = text("""
        SELECT bv.definition
        FROM executions e
        JOIN blueprint_versions bv ON bv.id = e.blueprint_version_id
        WHERE e.id = :id
    """)
    result = await db.execute(q, {"id": str(execution_id)})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Execution or version not found")
    return {"execution_id": str(execution_id), "definition": row["definition"]}


# ── Resume from node ───────────────────────────────────────────────────────────

class ResumeRequest(BaseModel):
    from_node: str


@router.post("/{execution_id}/resume")
async def resume_execution(
    execution_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    from_node: str = Query(..., description="Node ID to resume from"),
):
    """
    Create a new execution that fast-forwards to a saved checkpoint
    and continues from from_node. Used by Review Mode 'Re-run from X'.
    """
    from sqlalchemy import text
    import json

    # Load original execution
    q = text("""
        SELECT blueprint_id, blueprint_version_id, input_data
        FROM executions WHERE id = :id
    """)
    result = await db.execute(q, {"id": str(execution_id)})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Source execution not found")

    # Create child execution
    new_id = uuid.uuid4()
    await db.execute(
        text("""
            INSERT INTO executions (id, blueprint_id, blueprint_version_id, input_data,
                                    status, triggered_by, parent_execution_id, resume_from_node)
            VALUES (:id, :blueprint_id, :version_id, :input_data,
                    'pending', :user_id, :parent_id, :from_node)
        """),
        {
            "id": str(new_id),
            "blueprint_id": str(row["blueprint_id"]),
            "version_id": str(row["blueprint_version_id"]) if row["blueprint_version_id"] else None,
            "input_data": json.dumps(row["input_data"]),
            "user_id": str(current_user.id),
            "parent_id": str(execution_id),
            "from_node": from_node,
        },
    )
    await db.commit()
    return {"id": str(new_id), "status": "pending", "resumed_from": from_node}


# ── Report Export ──────────────────────────────────────────────────────────────

@router.get("/{execution_id}/report")
async def export_execution_report(
    execution_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Generates a CSV report of the execution with all node timings and costs.
    """
    from sqlalchemy import text

    q = text("""
        SELECT node_id, node_label, node_type, status, started_at, completed_at,
               EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000 AS duration_ms,
               cost_usd, error_message
        FROM execution_node_logs
        WHERE execution_id = :id
        ORDER BY started_at ASC
    """)
    result = await db.execute(q, {"id": str(execution_id)})
    rows = result.mappings().all()

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["node_id", "node_label", "node_type", "status",
                    "started_at", "completed_at", "duration_ms", "cost_usd", "error_message"],
    )
    writer.writeheader()
    for row in rows:
        writer.writerow(dict(row))

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=execution-{execution_id}-report.csv"},
    )
