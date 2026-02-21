import logging
import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from pydantic import BaseModel as PydanticBaseModel
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from database import get_session
from crud import CRUDTemplate, CRUDSkill
from infra.observability import get_langfuse

router = APIRouter(prefix="/api", tags=["structuring"])
logger = logging.getLogger(__name__)

class StructureRequest(PydanticBaseModel):
    group_id: str
    free_text: str
    skill_id: Optional[str] = None
    user_id: Optional[str] = "user_default"

@router.post("/structure")
async def structure_message(request: StructureRequest, session: AsyncSession = Depends(get_session)):
    """The core pipeline: Free-text Hebrew -> Template-structured JSON using Skills & Langfuse."""
    
    # 1. Lookup Template
    template = await CRUDTemplate.get_by_group(session, request.group_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"No template registered for group {request.group_id}")

    # 2. Lookup Skill
    skill = None
    if request.skill_id:
        from uuid import UUID
        try:
            skill = await CRUDSkill.get(session, UUID(request.skill_id))
        except ValueError:
            pass
            
    if not skill:
        skill = await CRUDSkill.get_by_type(session, "structuring")
    
    if not skill:
        # Default fallback
        skill_prompt = "You are an extraction assistant. Extract JSON from the Hebrew text below based on this schema: {template_schema}"
        model_name = "gpt-4o-mini"
        temperature = 0.1
        skill_id_str = "default"
    else:
        skill_prompt = skill.prompt_template
        model_name = skill.parameters.get("model", "gpt-4o-mini")
        temperature = skill.parameters.get("temperature", 0.1)
        skill_id_str = str(skill.id)

    # 3. Prepare Prompt Variables
    schema_json = json.dumps(template.fields, ensure_ascii=False, indent=2)
    glossary_json = json.dumps(template.glossary_terms, ensure_ascii=False, indent=2)
    examples_json = json.dumps(template.few_shot_examples, ensure_ascii=False, indent=2)
    
    system_prompt = skill_prompt.replace("{template_schema}", schema_json)
    system_prompt = system_prompt.replace("{glossary}", glossary_json)
    system_prompt = system_prompt.replace("{examples}", examples_json)
    system_prompt = system_prompt.replace("{language}", template.language)

    # 4. Langfuse Tracing
    lf = get_langfuse()
    trace = lf.trace(
        name="hebrew_message_structuring",
        user_id=request.user_id,
        metadata={
            "group_id": request.group_id,
            "template_name": template.name,
            "skill_id": skill_id_str,
            "model": model_name
        }
    )

    generation = trace.generation(
        name="llm_extraction",
        model=model_name,
        input={"system": system_prompt, "user": request.free_text},
        metadata={"temperature": temperature, "max_tokens": skill.parameters.get("max_tokens", 2048) if skill else 2048}
    )

    # 5. Call LLM
    try:
        llm = ChatOpenAI(model=model_name, temperature=temperature)
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=request.free_text)
        ])
        
        raw_content = response.content.strip()
        # Clean markdown code blocks
        if "```json" in raw_content:
            raw_content = raw_content.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_content:
            raw_content = raw_content.split("```")[1].split("```")[0].strip()
            
        structured_data = json.loads(raw_content)
        generation.end(output=structured_data)
        
        # 6. Evaluation Logic
        # Score based on required fields presence
        required_fields = [f["name"] for f in template.fields if f.get("required")]
        missing = [f for f in required_fields if f not in structured_data or not structured_data[f]]
        
        confidence = 1.0
        if template.fields:
            confidence = 1.0 - (len(missing) / len(template.fields))
        
        trace.score(name="extraction_confidence", value=confidence)
        
        # Add a score for hallucination check (mock or simple check)
        # In a real app, we might use another LLM call to verify
        
        lf.flush()
        
        return {
            "structured": structured_data,
            "confidence": confidence,
            "missing_fields": missing,
            "metadata": {
                "trace_id": trace.id,
                "model": model_name
            }
        }

    except Exception as e:
        generation.end(error=str(e))
        trace.score(name="error", value=1.0, comment=str(e))
        lf.flush()
        logger.error(f"Extraction failed for group {request.group_id}: {e}")
        return {
            "structured": {},
            "confidence": 0,
            "error": str(e),
            "missing_fields": [f["name"] for f in template.fields if f.get("required")]
        }
