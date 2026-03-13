"""
Organization service — handles org profile read/update with admin shortcuts.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select

from app.models.organization import Organization
from app.models.user import User, UserRole
from app.schemas.organization import OrganizationAdminUpdate, OrganizationUpdate
from app.services.base_service import BaseService


class OrganizationService(BaseService):
    """Read/update the current user's organization."""

    async def get_my_org(self) -> Organization:
        """Return the org that the current user belongs to."""
        result = await self._db.execute(
            select(Organization).where(Organization.id == self._org_id)
        )
        org = result.scalar_one_or_none()
        if org is None:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
        return org

    async def update_my_org(self, data: OrganizationUpdate) -> Organization:
        """Update org fields. Admins only."""
        self._require_admin()
        org = await self.get_my_org()
        dumped = data.model_dump(exclude_none=True)
        
        if "provider_keys" in dumped:
            org.set_provider_keys(dumped.pop("provider_keys"))
            
        for field, value in dumped.items():
            setattr(org, field, value)
        await self._db.flush()
        return org

    # -----------------------------------------------------------------------
    # Super-admin helpers (platform owner — not org-scoped)
    # -----------------------------------------------------------------------
    async def admin_list_all(self) -> list[Organization]:
        """List every org on the platform. Platform admin only."""
        self._require_admin()
        result = await self._db.execute(select(Organization))
        return list(result.scalars().all())

    async def admin_update_org(self, org_id: uuid.UUID, data: OrganizationAdminUpdate) -> Organization:
        """Update any org by ID (platform admin)."""
        self._require_admin()
        result = await self._db.execute(select(Organization).where(Organization.id == org_id))
        org = result.scalar_one_or_none()
        if org is None:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
            
        dumped = data.model_dump(exclude_none=True)
        if "provider_keys" in dumped:
            org.set_provider_keys(dumped.pop("provider_keys"))
            
        for field, value in dumped.items():
            setattr(org, field, value)
        await self._db.flush()
        return org
