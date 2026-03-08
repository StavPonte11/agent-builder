"""
Base service class with org isolation pattern and role checks.
All domain services should inherit from this.
"""
from __future__ import annotations

import uuid
from typing import Any, TypeVar

from fastapi import HTTPException, status
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base
from app.models.user import User, UserRole

T = TypeVar("T", bound=Base)


class BaseService:
    """
    Base class for all domain services.

    Enforces:
    - Org isolation: every list/get query filters by org_id
    - Role-based write protection
    - Soft delete pattern (filters out is_deleted=True by default)
    """

    def __init__(self, db: AsyncSession, current_user: User) -> None:
        self._db = db
        self._user = current_user
        self._org_id: uuid.UUID = current_user.org_id

    # ------------------------------------------------------------------
    # Org isolation helpers
    # ------------------------------------------------------------------
    def _org_filter(self, stmt: Select[Any]) -> Select[Any]:
        """
        Append org_id and soft-delete filters to any SELECT statement.
        MUST be called on every query that touches org-scoped data.
        """
        model_cls = stmt.columns_clause_froms[0] if stmt.columns_clause_froms else None
        if model_cls is None:
            return stmt
        # Apply org + soft delete filters
        if hasattr(model_cls, "org_id"):
            stmt = stmt.where(model_cls.org_id == self._org_id)  # type: ignore[union-attr]
        if hasattr(model_cls, "is_deleted"):
            stmt = stmt.where(model_cls.is_deleted.is_(False))  # type: ignore[union-attr]
        return stmt

    # ------------------------------------------------------------------
    # Role checks
    # ------------------------------------------------------------------
    def _require_admin(self) -> None:
        if self._user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin role required for this action.",
            )

    def _require_builder_or_admin(self) -> None:
        if self._user.role not in (UserRole.BUILDER, UserRole.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Builder or Admin role required for this action.",
            )

    # ------------------------------------------------------------------
    # Generic CRUD helpers
    # ------------------------------------------------------------------
    async def _get_by_id(self, model_cls: type[T], entity_id: uuid.UUID) -> T:
        """Fetch a single entity by ID within the org, 404 if not found."""
        stmt = select(model_cls).where(model_cls.id == entity_id)  # type: ignore[attr-defined]
        if hasattr(model_cls, "org_id"):
            stmt = stmt.where(model_cls.org_id == self._org_id)  # type: ignore[union-attr]
        if hasattr(model_cls, "is_deleted"):
            stmt = stmt.where(model_cls.is_deleted.is_(False))  # type: ignore[union-attr]
        result = await self._db.execute(stmt)
        entity = result.scalar_one_or_none()
        if entity is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{model_cls.__name__} not found.",
            )
        return entity

    async def _soft_delete(self, entity: Any) -> None:
        """Mark an entity as deleted (soft delete)."""
        entity.is_deleted = True
        await self._db.flush()
