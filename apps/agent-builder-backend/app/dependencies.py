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
from app.services.auth_service import AuthService

# Re-export for convenience
DbSession = Annotated[AsyncSession, Depends(get_db)]
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer_scheme)],
    db: DbSession,
) -> User:
    """
    Extract and validate JWT Bearer token, returning the authenticated User.
    Also accepts API key format: 'ApiKey <key>'.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    auth_service = AuthService(db)

    # Try JWT first, then API key
    if token.startswith("ak_"):  # API key prefix
        user = await auth_service.validate_api_key(token)
    else:
        user = await auth_service.validate_access_token(token)

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
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
