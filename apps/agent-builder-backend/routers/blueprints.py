import json
import pathlib
import logging
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List

from database import get_session
from db_models import AgentBlueprint
from crud import CRUDBlueprint
from api_schemas import BlueprintCreateRequest, BlueprintResponse

router = APIRouter(prefix="/api/blueprints", tags=["blueprints"])
logger = logging.getLogger(__name__)

TEMPLATES_DIR = pathlib.Path(__file__).parent.parent / "templates"

@router.post("", response_model=BlueprintResponse)
async def create_blueprint(
    request: BlueprintCreateRequest,
    session: AsyncSession = Depends(get_session)
):
    owner_id = "user_default" 
    blueprint_data = request.blueprint_data.model_dump()
    
    new_blueprint = AgentBlueprint(
        name=request.name,
        description=request.description,
        blueprint_data=blueprint_data,
        owner_id=owner_id,
        organization_id=request.organization_id
    )
    
    saved_blueprint = await CRUDBlueprint.create(session, new_blueprint)
    
    return BlueprintResponse(
        id=saved_blueprint.id,
        name=saved_blueprint.name,
        description=saved_blueprint.description,
        blueprint_data=saved_blueprint.blueprint_data,
        owner_id=saved_blueprint.owner_id,
        created_at=saved_blueprint.created_at.isoformat(),
        updated_at=saved_blueprint.updated_at.isoformat()
    )

@router.get("/templates")
async def list_blueprint_templates():
    """List all JSON blueprint templates available in the templates/ directory."""
    templates = []
    for path in sorted(TEMPLATES_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            templates.append({
                "template_id": path.stem,
                "name": data.get("name", path.stem),
                "description": data.get("description", ""),
                "tags": data.get("metadata", {}).get("tags", []),
                "recommended_config": data.get("metadata", {}).get("recommended_config", {}),
            })
        except Exception as e:
            logger.warning(f"Could not parse template {path.name}: {e}")
    return templates

@router.post("/import-template")
async def import_blueprint_template(
    template_id: str,
    name: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    template_path = TEMPLATES_DIR / f"{template_id}.json"
    if not template_path.exists():
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    data = json.loads(template_path.read_text(encoding="utf-8"))
    blueprint_data = {
        "nodes": data.get("nodes", []),
        "edges": data.get("edges", []),
        "entry_point": data.get("entry_point", data.get("nodes", [{}])[0].get("id", "start")),
    }
    new_blueprint = AgentBlueprint(
        name=name or data.get("name", template_id),
        description=data.get("description", ""),
        blueprint_data=blueprint_data,
        owner_id="user_default",
        organization_id=None,
    )
    saved = await CRUDBlueprint.create(session, new_blueprint)
    logger.info(f"Template '{template_id}' imported as blueprint {saved.id}")
    return BlueprintResponse(
        id=saved.id,
        name=saved.name,
        description=saved.description,
        blueprint_data=saved.blueprint_data,
        owner_id=saved.owner_id,
        created_at=saved.created_at.isoformat(),
        updated_at=saved.updated_at.isoformat(),
    )

@router.get("/{blueprint_id}", response_model=BlueprintResponse)
async def get_blueprint(
    blueprint_id: str,
    session: AsyncSession = Depends(get_session)
):
    try:
        bp_uuid = UUID(blueprint_id)
        blueprint = await CRUDBlueprint.get(session, bp_uuid)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Blueprint '{blueprint_id}' not found (invalid UUID format)")
    
    if not blueprint:
        raise HTTPException(status_code=404, detail="Blueprint not found")
        
    return BlueprintResponse(
        id=blueprint.id,
        name=blueprint.name,
        description=blueprint.description,
        blueprint_data=blueprint.blueprint_data,
        owner_id=blueprint.owner_id,
        created_at=blueprint.created_at.isoformat(),
        updated_at=blueprint.updated_at.isoformat()
    )
