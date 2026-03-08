"""
MessageTemplate routes. Full CRUD + publish/unpublish.
GET    /message-templates/
POST   /message-templates/
GET    /message-templates/{id}
PUT    /message-templates/{id}
DELETE /message-templates/{id}
POST   /message-templates/{id}/publish
POST   /message-templates/{id}/unpublish
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Query, status

from app.dependencies import CurrentUser, DbSession
from app.schemas.message_template import (
    MessageTemplateCreate,
    MessageTemplateResponse,
    MessageTemplateUpdate,
)
from app.services.message_template_service import MessageTemplateService

router = APIRouter(prefix="/message-templates", tags=["Message Templates"])


@router.get("/", response_model=list[MessageTemplateResponse])
async def list_message_templates(
    current_user: CurrentUser,
    db: DbSession,
    category: Optional[str] = Query(default=None),
) -> list[MessageTemplateResponse]:
    svc = MessageTemplateService(db, current_user)
    return [MessageTemplateResponse.model_validate(t) for t in await svc.list(category=category)]


@router.post("/", response_model=MessageTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_message_template(
    body: MessageTemplateCreate, current_user: CurrentUser, db: DbSession
) -> MessageTemplateResponse:
    svc = MessageTemplateService(db, current_user)
    return MessageTemplateResponse.model_validate(await svc.create(body))


@router.get("/{template_id}", response_model=MessageTemplateResponse)
async def get_message_template(
    template_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> MessageTemplateResponse:
    svc = MessageTemplateService(db, current_user)
    return MessageTemplateResponse.model_validate(await svc.get(template_id))


@router.put("/{template_id}", response_model=MessageTemplateResponse)
async def update_message_template(
    template_id: uuid.UUID,
    body: MessageTemplateUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> MessageTemplateResponse:
    svc = MessageTemplateService(db, current_user)
    return MessageTemplateResponse.model_validate(await svc.update(template_id, body))


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message_template(
    template_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    svc = MessageTemplateService(db, current_user)
    await svc.delete(template_id)


@router.post("/{template_id}/publish", response_model=MessageTemplateResponse)
async def publish_message_template(
    template_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> MessageTemplateResponse:
    svc = MessageTemplateService(db, current_user)
    return MessageTemplateResponse.model_validate(await svc.publish(template_id))


@router.post("/{template_id}/unpublish", response_model=MessageTemplateResponse)
async def unpublish_message_template(
    template_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> MessageTemplateResponse:
    svc = MessageTemplateService(db, current_user)
    return MessageTemplateResponse.model_validate(await svc.unpublish(template_id))
