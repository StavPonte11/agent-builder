from datetime import datetime
from uuid import UUID
from typing import List, Optional, Dict, Any
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from db_models import User, AgentBlueprint, ExecutionSession, Organization, MessageTemplate, Skill


class CRUDUser:
    @staticmethod
    async def get_or_create(session: AsyncSession, user_id: str, email: Optional[str] = None) -> User:
        statement = select(User).where(User.id == user_id)
        result = await session.execute(statement)
        user = result.scalar_one_or_none()
        if not user:
            user = User(id=user_id, email=email)
            session.add(user)
            await session.commit()
            await session.refresh(user)
        return user


class CRUDBlueprint:
    @staticmethod
    async def create(session: AsyncSession, blueprint: AgentBlueprint) -> AgentBlueprint:
        session.add(blueprint)
        await session.commit()
        await session.refresh(blueprint)
        return blueprint

    @staticmethod
    async def get(session: AsyncSession, blueprint_id: UUID) -> Optional[AgentBlueprint]:
        statement = select(AgentBlueprint).where(AgentBlueprint.id == blueprint_id)
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_by_owner(session: AsyncSession, owner_id: str) -> List[AgentBlueprint]:
        statement = select(AgentBlueprint).where(AgentBlueprint.owner_id == owner_id)
        result = await session.execute(statement)
        return result.scalars().all()

    @staticmethod
    async def update(session: AsyncSession, blueprint_id: UUID, data: Dict[str, Any]) -> Optional[AgentBlueprint]:
        blueprint = await CRUDBlueprint.get(session, blueprint_id)
        if not blueprint:
            return None
        for key, value in data.items():
            setattr(blueprint, key, value)
        session.add(blueprint)
        await session.commit()
        await session.refresh(blueprint)
        return blueprint


class CRUDExecution:
    @staticmethod
    async def create(session: AsyncSession, execution: ExecutionSession) -> ExecutionSession:
        session.add(execution)
        await session.commit()
        await session.refresh(execution)
        return execution

    @staticmethod
    async def get(session: AsyncSession, execution_id: UUID) -> Optional[ExecutionSession]:
        statement = select(ExecutionSession).where(ExecutionSession.id == execution_id)
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    @staticmethod
    async def update_status(session: AsyncSession, execution_id: UUID, status: str, result_data: Optional[Dict] = None) -> Optional[ExecutionSession]:
        execution = await CRUDExecution.get(session, execution_id)
        if not execution:
            return None
        execution.status = status
        if result_data:
            execution.result_data = result_data
        session.add(execution)
        await session.commit()
        await session.refresh(execution)
        return execution


class CRUDTemplate:
    @staticmethod
    async def create(session: AsyncSession, template: MessageTemplate) -> MessageTemplate:
        session.add(template)
        await session.commit()
        await session.refresh(template)
        return template

    @staticmethod
    async def get(session: AsyncSession, template_id: UUID) -> Optional[MessageTemplate]:
        result = await session.execute(select(MessageTemplate).where(MessageTemplate.id == template_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_group(session: AsyncSession, group_id: str) -> Optional[MessageTemplate]:
        result = await session.execute(select(MessageTemplate).where(MessageTemplate.group_id == group_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def list_all(session: AsyncSession) -> List[MessageTemplate]:
        result = await session.execute(select(MessageTemplate).order_by(MessageTemplate.created_at.desc()))
        return list(result.scalars().all())

    @staticmethod
    async def update(session: AsyncSession, template_id: UUID, data: Dict[str, Any]) -> Optional[MessageTemplate]:
        template = await CRUDTemplate.get(session, template_id)
        if not template:
            return None
        for key, value in data.items():
            setattr(template, key, value)
        template.updated_at = datetime.utcnow()
        session.add(template)
        await session.commit()
        await session.refresh(template)
        return template

    @staticmethod
    async def delete(session: AsyncSession, template_id: UUID) -> bool:
        template = await CRUDTemplate.get(session, template_id)
        if not template:
            return False
        await session.delete(template)
        await session.commit()
        return True


class CRUDSkill:
    @staticmethod
    async def create(session: AsyncSession, skill: Skill) -> Skill:
        session.add(skill)
        await session.commit()
        await session.refresh(skill)
        return skill

    @staticmethod
    async def get(session: AsyncSession, skill_id: UUID) -> Optional[Skill]:
        result = await session.execute(select(Skill).where(Skill.id == skill_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def list_all(session: AsyncSession) -> List[Skill]:
        result = await session.execute(select(Skill).order_by(Skill.created_at.desc()))
        return list(result.scalars().all())

    @staticmethod
    async def get_by_type(session: AsyncSession, skill_type: str) -> Optional[Skill]:
        from sqlalchemy import select
        result = await session.execute(
            select(Skill).where(Skill.skill_type == skill_type).order_by(Skill.created_at.desc())
        )
        return result.scalars().first()

    @staticmethod
    async def update(session: AsyncSession, skill_id: UUID, data: Dict[str, Any]) -> Optional[Skill]:
        skill = await CRUDSkill.get(session, skill_id)
        if not skill:
            return None
        for key, value in data.items():
            setattr(skill, key, value)
        skill.updated_at = datetime.utcnow()
        session.add(skill)
        await session.commit()
        await session.refresh(skill)
        return skill

    @staticmethod
    async def delete(session: AsyncSession, skill_id: UUID) -> bool:
        skill = await CRUDSkill.get(session, skill_id)
        if not skill:
            return False
        await session.delete(skill)
        await session.commit()
        return True
