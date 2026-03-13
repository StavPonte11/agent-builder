"""
evaluation_datasets.py — Langfuse dataset management API.

Routes:
  POST /evaluation/datasets          → create a new Langfuse dataset
  GET  /evaluation/datasets          → list datasets for this org
  POST /evaluation/datasets/{id}/items → add execution outputs as dataset items
  GET  /evaluation/runs              → list evaluation runs (with filters)
"""
from __future__ import annotations

import os
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from app.dependencies import CurrentUser, DbSession

router = APIRouter(prefix="/evaluation", tags=["Evaluation"])


class CreateDatasetRequest(BaseModel):
    name: str
    blueprint_id: Optional[str] = None
    description: str = ""


class AddItemsRequest(BaseModel):
    execution_ids: list[str]


@router.post("/datasets", status_code=201)
async def create_dataset(
    body: CreateDatasetRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Creates a Langfuse dataset via the Langfuse Python SDK.
    Falls back to local record if Langfuse is not configured.
    """
    dataset_id = str(uuid.uuid4())

    # Try Langfuse SDK
    lf_dataset_id = None
    try:
        from langfuse import Langfuse
        lf = Langfuse(
            public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
            secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
            host=os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com"),
        )
        dataset = lf.create_dataset(name=body.name, description=body.description)
        lf_dataset_id = dataset.id
    except Exception:
        pass  # Langfuse not configured, continue with local record

    await db.execute(
        text("""
            INSERT INTO eval_datasets (id, org_id, name, blueprint_id, langfuse_dataset_id, created_by, created_at)
            VALUES (:id, :org_id, :name, :bp_id, :lf_id, :user_id, NOW())
        """),
        {
            "id": dataset_id,
            "org_id": str(current_user.org_id),
            "name": body.name,
            "bp_id": body.blueprint_id,
            "lf_id": lf_dataset_id,
            "user_id": str(current_user.id),
        },
    )
    await db.commit()
    return {"id": dataset_id, "name": body.name, "langfuse_dataset_id": lf_dataset_id}


@router.get("/datasets")
async def list_datasets(
    current_user: CurrentUser,
    db: DbSession,
    blueprint_id: Optional[str] = Query(None),
):
    query = "SELECT * FROM eval_datasets WHERE org_id = :org_id"
    params: dict = {"org_id": str(current_user.org_id)}
    if blueprint_id:
        query += " AND blueprint_id = :bp_id"
        params["bp_id"] = blueprint_id
    query += " ORDER BY created_at DESC"
    result = await db.execute(text(query), params)
    return [dict(r) for r in result.mappings().all()]


@router.post("/datasets/{dataset_id}/items")
async def add_items_to_dataset(
    dataset_id: str,
    body: AddItemsRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Adds execution outputs as dataset items.
    If Langfuse is configured, syncs to Langfuse as well.
    """
    # Fetch executions + their output data
    result = await db.execute(
        text("""
            SELECT id, input_data, output_data
            FROM executions
            WHERE id = ANY(:ids) AND org_id = :org_id
        """),
        {"ids": body.execution_ids, "org_id": str(current_user.org_id)},
    )
    executions = result.mappings().all()

    # Get dataset's Langfuse ID
    ds_result = await db.execute(
        text("SELECT langfuse_dataset_id, name FROM eval_datasets WHERE id = :id"),
        {"id": dataset_id},
    )
    ds = ds_result.mappings().first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    items_added = []
    for ex in executions:
        item_id = str(uuid.uuid4())
        # Sync to Langfuse
        if ds["langfuse_dataset_id"]:
            try:
                from langfuse import Langfuse
                import json
                lf = Langfuse(
                    public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
                    secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
                    host=os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com"),
                )
                lf.create_dataset_item(
                    dataset_name=ds["name"],
                    input=ex["input_data"] or {},
                    expected_output=ex["output_data"] or {},
                    metadata={"execution_id": str(ex["id"])},
                )
            except Exception:
                pass

        await db.execute(
            text("""
                INSERT INTO eval_dataset_items (id, dataset_id, execution_id, input_data, expected_output, created_at)
                VALUES (:id, :ds_id, :exec_id, :input::jsonb, :output::jsonb, NOW())
                ON CONFLICT DO NOTHING
            """),
            {
                "id": item_id,
                "ds_id": dataset_id,
                "exec_id": str(ex["id"]),
                "input": __import__("json").dumps(ex["input_data"] or {}),
                "output": __import__("json").dumps(ex["output_data"] or {}),
            },
        )
        items_added.append(item_id)

    await db.commit()
    return {"added": len(items_added), "item_ids": items_added}


@router.get("/runs")
async def list_eval_runs(
    current_user: CurrentUser,
    db: DbSession,
    blueprint_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    query = """
        SELECT ee.id, ee.execution_id, ee.blueprint_id, ee.aggregate_score,
               ee.passed, ee.dimensions, ee.judge_model, ee.created_at
        FROM execution_evaluations ee
        JOIN executions e ON e.id = ee.execution_id
        WHERE e.org_id = :org_id
    """
    params: dict = {"org_id": str(current_user.org_id)}
    if blueprint_id:
        query += " AND ee.blueprint_id = :bp_id"
        params["bp_id"] = blueprint_id
    query += " ORDER BY ee.created_at DESC LIMIT :limit"
    params["limit"] = limit

    result = await db.execute(text(query), params)
    rows = result.mappings().all()
    return [
        {
            **dict(r),
            "id": str(r["id"]),
            "execution_id": str(r["execution_id"]),
            "blueprint_id": str(r["blueprint_id"]),
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]
