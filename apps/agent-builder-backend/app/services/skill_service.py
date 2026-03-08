"""
Skill service — full CRUD + publish/unpublish.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select

from app.models.prompt_template_skill import Skill
from app.schemas.skill import SkillCreate, SkillUpdate
from app.services.base_service import BaseService


class SkillService(BaseService):

    async def list(self, skill_type: str | None = None) -> list[Skill]:
        stmt = select(Skill).where(
            Skill.org_id == self._org_id,
            Skill.is_deleted.is_(False),
        )
        if skill_type:
            stmt = stmt.where(Skill.skill_type == skill_type)
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def get(self, skill_id: uuid.UUID) -> Skill:
        return await self._get_by_id(Skill, skill_id)

    async def create(self, data: SkillCreate) -> Skill:
        self._require_builder_or_admin()
        skill = Skill(
            org_id=self._org_id,
            created_by=self._user.id,
            **data.model_dump(),
        )
        self._db.add(skill)
        await self._db.flush()
        return skill

    async def update(self, skill_id: uuid.UUID, data: SkillUpdate) -> Skill:
        self._require_builder_or_admin()
        skill = await self._get_by_id(Skill, skill_id)
        changed = data.model_dump(exclude_none=True)
        if changed:
            for field, value in changed.items():
                setattr(skill, field, value)
            skill.version += 1
        await self._db.flush()
        return skill

    async def delete(self, skill_id: uuid.UUID) -> None:
        self._require_builder_or_admin()
        skill = await self._get_by_id(Skill, skill_id)
        await self._soft_delete(skill)

    async def publish(self, skill_id: uuid.UUID) -> Skill:
        self._require_admin()
        skill = await self._get_by_id(Skill, skill_id)
        skill.is_published = True
        await self._db.flush()
        return skill

    async def unpublish(self, skill_id: uuid.UUID) -> Skill:
        self._require_admin()
        skill = await self._get_by_id(Skill, skill_id)
        skill.is_published = False
        await self._db.flush()
        return skill
