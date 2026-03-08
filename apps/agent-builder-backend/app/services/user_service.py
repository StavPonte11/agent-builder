"""
User service — CRUD for users within an organization.
"""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select

from app.models.user import User, UserRole
from app.schemas.user import UserAdminUpdate, UserCreate, UserUpdate
from app.services.auth_service import AuthService
from app.services.base_service import BaseService


class UserService(BaseService):
    """Manage users within the current user's org."""

    async def get_me(self) -> User:
        return self._user

    async def update_me(self, data: UserUpdate) -> User:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(self._user, field, value)
        await self._db.flush()
        return self._user

    # -----------------------------------------------------------------------
    # Admin endpoints
    # -----------------------------------------------------------------------
    async def list_users(self) -> list[User]:
        """List all (non-deleted) users in the org. Admin only."""
        self._require_admin()
        result = await self._db.execute(
            select(User).where(
                User.org_id == self._org_id,
                User.is_deleted.is_(False),
            )
        )
        return list(result.scalars().all())

    async def create_user(self, data: UserCreate) -> User:
        """Invite a new user into the org. Admin only."""
        self._require_admin()
        existing = await self._db.execute(select(User).where(User.email == data.email.lower()))
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered.")
        user = User(
            org_id=self._org_id,
            email=data.email.lower(),
            hashed_password=AuthService.hash_password(data.password),
            role=data.role,
        )
        self._db.add(user)
        await self._db.flush()
        return user

    async def get_user(self, user_id: uuid.UUID) -> User:
        """Get a specific user within the org. Admin only."""
        self._require_admin()
        return await self._get_by_id(User, user_id)

    async def update_user(self, user_id: uuid.UUID, data: UserAdminUpdate) -> User:
        """Update role / active status of a user. Admin only."""
        self._require_admin()
        user = await self._get_by_id(User, user_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(user, field, value)
        await self._db.flush()
        return user

    async def delete_user(self, user_id: uuid.UUID) -> None:
        """Soft-delete a user from the org. Admin only."""
        self._require_admin()
        if user_id == self._user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete yourself.")
        user = await self._get_by_id(User, user_id)
        await self._soft_delete(user)
