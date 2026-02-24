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
        input={"system": skill_prompt, "user": request.free_text},
        metadata={"temperature": temperature, "max_tokens": skill.parameters.get("max_tokens", 2048) if skill else 2048}
    )

    # 5. Call LLM through standalone executor
    try:
        import sys
        import os
        # Add monorepo root to path to import packages.skills_framework
        sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))
        from packages.skills_framework.executor import SkillExecutor
        
        executor = SkillExecutor()
        
        # We need to construct a dict representing the template since executor expects dictionary
        template_data = {
            "fields": template.fields,
            "glossary_terms": template.glossary_terms,
            "few_shot_examples": template.few_shot_examples,
            "language": template.language
        }
        
        exec_result = await executor.execute(
            skill_prompt=skill_prompt,
            parameters={"model": model_name, "temperature": temperature},
            template_data=template_data,
            user_input=request.free_text
        )
        
        if not exec_result["success"]:
            raise Exception(exec_result["error"])
            
        structured_data = exec_result["output"]
        generation.end(output=structured_data)
        
        # 6. Evaluation Logic
        # Score based on required fields presence
        required_fields = [f["name"] for f in template.fields if f.get("required")]
        
        missing = []
        if isinstance(structured_data, dict):
            missing = [f for f in required_fields if f not in structured_data or not structured_data[f]]
        else:
            missing = required_fields
            
        confidence = 1.0
        if template.fields:
            confidence = 1.0 - (len(missing) / len(template.fields))
        
        trace.score(name="extraction_confidence", value=confidence)
        
        lf.flush()
        
        return {
            "structured": structured_data if isinstance(structured_data, dict) else {},
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
