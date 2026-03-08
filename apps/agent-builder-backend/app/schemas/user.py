"""Pydantic schemas for the User entity."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class UserResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    email: str
    role: UserRole
    is_active: bool
    last_login: datetime | None
    preferences: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    """Fields a user can update on their own profile."""
    preferences: dict | None = None


class UserAdminUpdate(BaseModel):
    """Fields admins can update on any user in their org."""
    role: UserRole | None = None
    is_active: bool | None = None
    preferences: dict | None = None


class UserCreate(BaseModel):
    """Admin-created user (invited to the org)."""
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.BUILDER
