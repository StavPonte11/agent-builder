"""
BasePrompt routes. Admin-write, all-read.
GET    /base-prompts/
POST   /base-prompts/
GET    /base-prompts/{id}
PUT    /base-prompts/{id}
DELETE /base-prompts/{id}
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, status

from app.dependencies import CurrentUser, DbSession
from app.schemas.base_prompt import BasePromptCreate, BasePromptResponse, BasePromptUpdate
from app.services.base_prompt_service import BasePromptService

router = APIRouter(prefix="/base-prompts", tags=["Base Prompts"])


@router.get("/", response_model=list[BasePromptResponse])
async def list_base_prompts(current_user: CurrentUser, db: DbSession) -> list[BasePromptResponse]:
    svc = BasePromptService(db, current_user)
    return [BasePromptResponse.model_validate(p) for p in await svc.list()]


@router.post("/", response_model=BasePromptResponse, status_code=status.HTTP_201_CREATED)
async def create_base_prompt(body: BasePromptCreate, current_user: CurrentUser, db: DbSession) -> BasePromptResponse:
    svc = BasePromptService(db, current_user)
    return BasePromptResponse.model_validate(await svc.create(body))


@router.get("/{prompt_id}", response_model=BasePromptResponse)
async def get_base_prompt(prompt_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> BasePromptResponse:
    svc = BasePromptService(db, current_user)
    return BasePromptResponse.model_validate(await svc.get(prompt_id))


@router.put("/{prompt_id}", response_model=BasePromptResponse)
async def update_base_prompt(
    prompt_id: uuid.UUID, body: BasePromptUpdate, current_user: CurrentUser, db: DbSession
) -> BasePromptResponse:
    svc = BasePromptService(db, current_user)
    return BasePromptResponse.model_validate(await svc.update(prompt_id, body))


@router.delete("/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_base_prompt(prompt_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    svc = BasePromptService(db, current_user)
    await svc.delete(prompt_id)
