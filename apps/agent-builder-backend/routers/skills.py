from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List

from database import get_session
from db_models import Skill
from crud import CRUDSkill

router = APIRouter(prefix="/api/skills", tags=["skills"])

@router.get("", response_model=List[Skill])
async def list_skills(session: AsyncSession = Depends(get_session)):
    return await CRUDSkill.list_all(session)

@router.post("", response_model=Skill)
async def create_skill(skill: Skill, session: AsyncSession = Depends(get_session)):
    return await CRUDSkill.create(session, skill)

@router.put("/{skill_id}", response_model=Skill)
async def update_skill(skill_id: UUID, data: dict, session: AsyncSession = Depends(get_session)):
    skill = await CRUDSkill.update(session, skill_id, data)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill

@router.delete("/{skill_id}")
async def delete_skill(skill_id: UUID, session: AsyncSession = Depends(get_session)):
    success = await CRUDSkill.delete(session, skill_id)
    if not success:
        raise HTTPException(status_code=404, detail="Skill not found")
    return {"status": "deleted"}
