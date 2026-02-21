from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List

from database import get_session
from db_models import MessageTemplate
from crud import CRUDTemplate

router = APIRouter(prefix="/api/message-templates", tags=["templates"])

@router.get("", response_model=List[MessageTemplate])
async def list_message_templates(session: AsyncSession = Depends(get_session)):
    return await CRUDTemplate.list_all(session)

@router.post("", response_model=MessageTemplate)
async def create_message_template(template: MessageTemplate, session: AsyncSession = Depends(get_session)):
    return await CRUDTemplate.create(session, template)

@router.get("/{template_id}", response_model=MessageTemplate)
async def get_message_template(template_id: UUID, session: AsyncSession = Depends(get_session)):
    template = await CRUDTemplate.get(session, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@router.put("/{template_id}", response_model=MessageTemplate)
async def update_message_template(template_id: UUID, data: dict, session: AsyncSession = Depends(get_session)):
    template = await CRUDTemplate.update(session, template_id, data)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@router.delete("/{template_id}")
async def delete_message_template(template_id: UUID, session: AsyncSession = Depends(get_session)):
    success = await CRUDTemplate.delete(session, template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"status": "deleted"}
