"""
Shared FastAPI dependencies used across all routes.
"""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.database import AsyncSession, get_db
from app.models.user import User, UserRole
from app.models.organization import Organization
from app.services.auth_service import AuthService
from sqlalchemy import select

# Re-export for convenience
DbSession = Annotated[AsyncSession, Depends(get_db)]
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer_scheme)],
    db: DbSession,
) -> User:
    """
    Bypassed authentication for testing.
    Automatically creates/returns a default admin user.
    """
    # 1. Ensure a default organization exists
    org_stmt = select(Organization).limit(1)
    result = await db.execute(org_stmt)
    org = result.scalars().first()
    
    if not org:
        org = Organization(name="Default Org", slug="default-org")
        db.add(org)
        await db.flush() # flush to get org.id

    # 2. Ensure a default admin user exists
    user_stmt = select(User).where(User.email == "admin@example.com").limit(1)
    result = await db.execute(user_stmt)
    user = result.scalars().first()

    if not user:
        user = User(
            email="admin@example.com",
            hashed_password="mock_password", # Doesn't matter, auth is bypassed
            role=UserRole.ADMIN,
            is_active=True,
            org_id=org.id
        )
        db.add(user)
        await db.commit()

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: UserRole):
    """
    Dependency factory that enforces role-based access control.
    Usage: Depends(require_role(UserRole.ADMIN, UserRole.BUILDER))
    """
    async def _check_role(current_user: CurrentUser) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {[r.value for r in roles]}",
            )
        return current_user

    return _check_role


AdminUser = Annotated[User, Depends(require_role(UserRole.ADMIN))]
BuilderOrAdminUser = Annotated[User, Depends(require_role(UserRole.BUILDER, UserRole.ADMIN))]
