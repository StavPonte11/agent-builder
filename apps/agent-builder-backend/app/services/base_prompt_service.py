"""
BasePrompt service — admin-write, all-read system prompts.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select

from app.models.prompt_template_skill import BasePrompt
from app.schemas.base_prompt import BasePromptCreate, BasePromptUpdate
from app.services.base_service import BaseService


class BasePromptService(BaseService):

    async def list(self) -> list[BasePrompt]:
        result = await self._db.execute(
            select(BasePrompt).where(
                BasePrompt.org_id == self._org_id,
                BasePrompt.is_deleted.is_(False),
            )
        )
        return list(result.scalars().all())

    async def get(self, prompt_id: uuid.UUID) -> BasePrompt:
        return await self._get_by_id(BasePrompt, prompt_id)

    async def create(self, data: BasePromptCreate) -> BasePrompt:
        self._require_admin()
        prompt = BasePrompt(
            org_id=self._org_id,
            created_by=self._user.id,
            **data.model_dump(),
        )
        self._db.add(prompt)
        await self._db.flush()
        return prompt

    async def update(self, prompt_id: uuid.UUID, data: BasePromptUpdate) -> BasePrompt:
        self._require_admin()
        prompt = await self._get_by_id(BasePrompt, prompt_id)
        changed = data.model_dump(exclude_none=True)
        if changed:
            for field, value in changed.items():
                setattr(prompt, field, value)
            prompt.version += 1
        await self._db.flush()
        return prompt

    async def delete(self, prompt_id: uuid.UUID) -> None:
        self._require_admin()
        prompt = await self._get_by_id(BasePrompt, prompt_id)
        await self._soft_delete(prompt)
