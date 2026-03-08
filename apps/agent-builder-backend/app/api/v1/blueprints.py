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


@router.get("/", response_model=list[BlueprintListItem])
async def list_blueprints(
    current_user: CurrentUser,
    db: DbSession,
    status_filter: Optional[BlueprintStatus] = Query(default=None, alias="status"),
    blueprint_type: Optional[BlueprintType] = Query(default=None),
) -> list[BlueprintListItem]:
    svc = BlueprintService(db, current_user)
    blueprints = await svc.list(status_filter=status_filter, blueprint_type=blueprint_type)
    return [BlueprintListItem.model_validate(b) for b in blueprints]


@router.post("/", response_model=BlueprintResponse, status_code=status.HTTP_201_CREATED)
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
