"""
Organization routes.
GET  /organizations/me
PUT  /organizations/me
GET  /organizations/          (admin)
PUT  /organizations/{org_id}  (admin)
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter

from app.dependencies import CurrentUser, DbSession
from app.schemas.organization import OrganizationAdminUpdate, OrganizationResponse, OrganizationUpdate
from app.services.organization_service import OrganizationService

router = APIRouter(prefix="/organizations", tags=["Organizations"])


@router.get("/me", response_model=OrganizationResponse)
async def get_my_organization(current_user: CurrentUser, db: DbSession) -> OrganizationResponse:
    svc = OrganizationService(db, current_user)
    org = await svc.get_my_org()
    return OrganizationResponse.model_validate(org)


@router.put("/me", response_model=OrganizationResponse)
async def update_my_organization(
    body: OrganizationUpdate, current_user: CurrentUser, db: DbSession
) -> OrganizationResponse:
    svc = OrganizationService(db, current_user)
    org = await svc.update_my_org(body)
    return OrganizationResponse.model_validate(org)


@router.get("/", response_model=list[OrganizationResponse])
async def list_all_organizations(current_user: CurrentUser, db: DbSession) -> list[OrganizationResponse]:
    """Platform admin: list all organizations."""
    svc = OrganizationService(db, current_user)
    orgs = await svc.admin_list_all()
    return [OrganizationResponse.model_validate(o) for o in orgs]


@router.put("/{org_id}", response_model=OrganizationResponse)
async def admin_update_organization(
    org_id: uuid.UUID, body: OrganizationAdminUpdate, current_user: CurrentUser, db: DbSession
) -> OrganizationResponse:
    svc = OrganizationService(db, current_user)
    org = await svc.admin_update_org(org_id, body)
    return OrganizationResponse.model_validate(org)
