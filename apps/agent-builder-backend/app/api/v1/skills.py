"""
Skill routes. Full CRUD + publish/unpublish.
GET    /skills/
POST   /skills/
GET    /skills/{id}
PUT    /skills/{id}
DELETE /skills/{id}
POST   /skills/{id}/publish
POST   /skills/{id}/unpublish
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Query, status

from app.dependencies import CurrentUser, DbSession
from app.schemas.skill import SkillCreate, SkillResponse, SkillUpdate
from app.services.skill_service import SkillService

router = APIRouter(prefix="/skills", tags=["Skills"])


@router.get("/", response_model=list[SkillResponse])
async def list_skills(
    current_user: CurrentUser,
    db: DbSession,
    skill_type: Optional[str] = Query(default=None),
) -> list[SkillResponse]:
    svc = SkillService(db, current_user)
    return [SkillResponse.model_validate(s) for s in await svc.list(skill_type=skill_type)]


@router.post("/", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(body: SkillCreate, current_user: CurrentUser, db: DbSession) -> SkillResponse:
    svc = SkillService(db, current_user)
    return SkillResponse.model_validate(await svc.create(body))


@router.get("/{skill_id}", response_model=SkillResponse)
async def get_skill(skill_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> SkillResponse:
    svc = SkillService(db, current_user)
    return SkillResponse.model_validate(await svc.get(skill_id))


@router.put("/{skill_id}", response_model=SkillResponse)
async def update_skill(
    skill_id: uuid.UUID, body: SkillUpdate, current_user: CurrentUser, db: DbSession
) -> SkillResponse:
    svc = SkillService(db, current_user)
    return SkillResponse.model_validate(await svc.update(skill_id, body))


@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(skill_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    svc = SkillService(db, current_user)
    await svc.delete(skill_id)


@router.post("/{skill_id}/publish", response_model=SkillResponse)
async def publish_skill(skill_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> SkillResponse:
    svc = SkillService(db, current_user)
    return SkillResponse.model_validate(await svc.publish(skill_id))


@router.post("/{skill_id}/unpublish", response_model=SkillResponse)
async def unpublish_skill(skill_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> SkillResponse:
    svc = SkillService(db, current_user)
    return SkillResponse.model_validate(await svc.unpublish(skill_id))
