"""
MessageTemplate service — full CRUD + publish/unpublish.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select

from app.models.prompt_template_skill import MessageTemplate
from app.schemas.message_template import MessageTemplateCreate, MessageTemplateUpdate
from app.services.base_service import BaseService


class MessageTemplateService(BaseService):

    async def list(self, category: str | None = None) -> list[MessageTemplate]:
        stmt = select(MessageTemplate).where(
            MessageTemplate.org_id == self._org_id,
            MessageTemplate.is_deleted.is_(False),
        )
        if category:
            stmt = stmt.where(MessageTemplate.category == category)
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def get(self, template_id: uuid.UUID) -> MessageTemplate:
        return await self._get_by_id(MessageTemplate, template_id)

    async def create(self, data: MessageTemplateCreate) -> MessageTemplate:
        self._require_builder_or_admin()
        template = MessageTemplate(
            org_id=self._org_id,
            created_by=self._user.id,
            **data.model_dump(),
        )
        self._db.add(template)
        await self._db.flush()
        return template

    async def update(self, template_id: uuid.UUID, data: MessageTemplateUpdate) -> MessageTemplate:
        self._require_builder_or_admin()
        template = await self._get_by_id(MessageTemplate, template_id)
        changed = data.model_dump(exclude_none=True)
        if changed:
            for field, value in changed.items():
                setattr(template, field, value)
            template.version += 1
        await self._db.flush()
        return template

    async def delete(self, template_id: uuid.UUID) -> None:
        self._require_builder_or_admin()
        template = await self._get_by_id(MessageTemplate, template_id)
        await self._soft_delete(template)

    async def publish(self, template_id: uuid.UUID) -> MessageTemplate:
        self._require_admin()
        template = await self._get_by_id(MessageTemplate, template_id)
        template.is_published = True
        await self._db.flush()
        return template

    async def unpublish(self, template_id: uuid.UUID) -> MessageTemplate:
        self._require_admin()
        template = await self._get_by_id(MessageTemplate, template_id)
        template.is_published = False
        await self._db.flush()
        return template
