"""
Blueprint service — CRUD + duplicate + validate + estimate + versioning + rollback.
"""
from __future__ import annotations

import uuid
from copy import deepcopy

from fastapi import HTTPException, status
from sqlalchemy import select

from app.models.blueprint import Blueprint, BlueprintStatus, BlueprintVersion
from app.schemas.blueprint import (
    BlueprintCostEstimate,
    BlueprintCreate,
    BlueprintDuplicateRequest,
    BlueprintRollbackRequest,
    BlueprintUpdate,
    BlueprintValidateResponse,
)
from app.services.base_service import BaseService

# Approximate cost per 1k tokens for common models (USD)
_MODEL_COST_MAP: dict[str, float] = {
    "gpt-4o": 0.005,
    "gpt-4o-mini": 0.00015,
    "claude-3-5-sonnet": 0.003,
    "gemini-1.5-pro": 0.00125,
    "default": 0.002,
}


class BlueprintService(BaseService):

    # -----------------------------------------------------------------------
    # CRUD
    # -----------------------------------------------------------------------
    async def list(
        self,
        status_filter: BlueprintStatus | None = None,
        blueprint_type: str | None = None,
    ) -> list[Blueprint]:
        stmt = select(Blueprint).where(
            Blueprint.org_id == self._org_id,
            Blueprint.is_deleted.is_(False),
        )
        if status_filter:
            stmt = stmt.where(Blueprint.status == status_filter)
        if blueprint_type:
            stmt = stmt.where(Blueprint.blueprint_type == blueprint_type)
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def get(self, blueprint_id: uuid.UUID) -> Blueprint:
        return await self._get_by_id(Blueprint, blueprint_id)

    async def create(self, data: BlueprintCreate) -> Blueprint:
        self._require_builder_or_admin()
        blueprint = Blueprint(
            org_id=self._org_id,
            created_by=self._user.id,
            **data.model_dump(),
        )
        self._db.add(blueprint)
        await self._db.flush()
        return blueprint

    async def update(self, blueprint_id: uuid.UUID, data: BlueprintUpdate) -> Blueprint:
        self._require_builder_or_admin()
        blueprint = await self._get_by_id(Blueprint, blueprint_id)
        if blueprint.status == BlueprintStatus.PUBLISHED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot edit a published blueprint. Create a new draft instead.",
            )
            
        # Optimistic Concurrency Check
        if data.expected_version is not None and blueprint.version != data.expected_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Blueprint was modified by another session (expected v{data.expected_version}, got v{blueprint.version}). Please refresh.",
            )
            
        for field, value in data.model_dump(exclude_none=True, exclude={"expected_version"}).items():
            setattr(blueprint, field, value)
            
        # Auto-increment version on significant change could go here, but currently
        # version increments happen during Publish. For draft auto-saves, we keep the version
        # stable or use an internal revision counter if needed. For now, OCC validates against the current version.
        
        await self._db.flush()
        return blueprint

    async def delete(self, blueprint_id: uuid.UUID) -> None:
        self._require_builder_or_admin()
        blueprint = await self._get_by_id(Blueprint, blueprint_id)
        
        # Clean up orphan Temporal crons
        from app.models.trigger import Trigger
        from app.services.scheduler_service import SchedulerService
        stmt = select(Trigger).where(Trigger.blueprint_id == blueprint_id)
        result = await self._db.execute(stmt)
        triggers = result.scalars().all()
        
        if triggers:
            scheduler_svc = SchedulerService(self._db)
            for trigger in triggers:
                await scheduler_svc.unregister_schedule(trigger)
                # optionally soft delete the trigger here too, but blueprint soft-delete covers mostly
                trigger.is_active = False 

        await self._soft_delete(blueprint)

    # -----------------------------------------------------------------------
    # Duplicate
    # -----------------------------------------------------------------------
    async def duplicate(self, blueprint_id: uuid.UUID, data: BlueprintDuplicateRequest) -> Blueprint:
        self._require_builder_or_admin()
        source = await self._get_by_id(Blueprint, blueprint_id)
        copy = Blueprint(
            org_id=self._org_id,
            created_by=self._user.id,
            name=data.name,
            description=source.description,
            blueprint_type=source.blueprint_type,
            definition=deepcopy(source.definition),
            base_prompt_id=source.base_prompt_id,
            config=deepcopy(source.config),
            tags=list(source.tags),
            parent_id=source.id,
            status=BlueprintStatus.DRAFT,
            version=1,
        )
        self._db.add(copy)
        await self._db.flush()
        return copy

    # -----------------------------------------------------------------------
    # Validate
    # -----------------------------------------------------------------------
    async def validate(self, blueprint_id: uuid.UUID) -> BlueprintValidateResponse:
        self._require_builder_or_admin()
        blueprint = await self._get_by_id(Blueprint, blueprint_id)
        
        from workflow_engine.compiler import BlueprintCompiler
        compiler = BlueprintCompiler()
        result = compiler.validate(blueprint.definition or {})
        
        return BlueprintValidateResponse(
            valid=result["valid"],
            errors=result["errors"],
            warnings=result["warnings"],
        )

    # -----------------------------------------------------------------------
    # Cost Estimate
    # -----------------------------------------------------------------------
    async def estimate_cost(self, blueprint_id: uuid.UUID) -> BlueprintCostEstimate:
        blueprint = await self._get_by_id(Blueprint, blueprint_id)
        nodes = (blueprint.definition or {}).get("nodes", [])
        total_tokens = 0
        total_cost = 0.0
        breakdown: list[dict] = []

        for node in nodes:
            if node.get("type") != "llm":
                continue
            node_data = node.get("data", {})
            model = node_data.get("model", "default")
            max_tokens = int(node_data.get("max_tokens", 1024))
            prompt_tokens = len(str(node_data.get("system_prompt", ""))) // 4  # rough 4 chars/token
            estimated_tokens = prompt_tokens + max_tokens
            cost_per_k = _MODEL_COST_MAP.get(model, _MODEL_COST_MAP["default"])
            node_cost = (estimated_tokens / 1000.0) * cost_per_k
            total_tokens += estimated_tokens
            total_cost += node_cost
            breakdown.append({"node_id": node["id"], "model": model, "tokens": estimated_tokens, "cost_usd": round(node_cost, 6)})

        return BlueprintCostEstimate(
            estimated_tokens_per_run=total_tokens,
            estimated_cost_usd_per_run=round(total_cost, 6),
            model_breakdown=breakdown,
        )

    # -----------------------------------------------------------------------
    # Versioning
    # -----------------------------------------------------------------------
    async def list_versions(self, blueprint_id: uuid.UUID) -> list[BlueprintVersion]:
        result = await self._db.execute(
            select(BlueprintVersion)
            .where(BlueprintVersion.blueprint_id == blueprint_id)
            .order_by(BlueprintVersion.version.desc())
        )
        return list(result.scalars().all())

    async def rollback(self, blueprint_id: uuid.UUID, data: BlueprintRollbackRequest) -> Blueprint:
        self._require_admin()
        blueprint = await self._get_by_id(Blueprint, blueprint_id)

        # Find the target version snapshot
        result = await self._db.execute(
            select(BlueprintVersion).where(
                BlueprintVersion.blueprint_id == blueprint_id,
                BlueprintVersion.version == data.version,
            )
        )
        version_snapshot = result.scalar_one_or_none()
        if version_snapshot is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Version {data.version} not found for blueprint {blueprint_id}.",
            )

        # Restore definition and bump version
        blueprint.definition = deepcopy(version_snapshot.definition)
        blueprint.version += 1
        blueprint.status = BlueprintStatus.DRAFT

        # Record the rollback as a new version entry
        rollback_version = BlueprintVersion(
            blueprint_id=blueprint.id,
            version=blueprint.version,
            definition=deepcopy(version_snapshot.definition),
            published_by=self._user.id,
            release_notes=data.release_notes or f"Rolled back to v{data.version}",
        )
        self._db.add(rollback_version)
        await self._db.flush()
        return blueprint
