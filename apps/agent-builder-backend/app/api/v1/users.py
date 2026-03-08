"""
User routes.
GET  /users/me
PUT  /users/me
GET  /users/              (admin)
POST /users/              (admin — invite user)
GET  /users/{user_id}     (admin)
PUT  /users/{user_id}     (admin)
DELETE /users/{user_id}   (admin)
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, status

from app.dependencies import CurrentUser, DbSession
from app.schemas.user import UserAdminUpdate, UserCreate, UserResponse, UserUpdate
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser, db: DbSession) -> UserResponse:
    svc = UserService(db, current_user)
    return UserResponse.model_validate(await svc.get_me())


@router.put("/me", response_model=UserResponse)
async def update_me(body: UserUpdate, current_user: CurrentUser, db: DbSession) -> UserResponse:
    svc = UserService(db, current_user)
    return UserResponse.model_validate(await svc.update_me(body))


@router.get("/", response_model=list[UserResponse])
async def list_users(current_user: CurrentUser, db: DbSession) -> list[UserResponse]:
    svc = UserService(db, current_user)
    return [UserResponse.model_validate(u) for u in await svc.list_users()]


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(body: UserCreate, current_user: CurrentUser, db: DbSession) -> UserResponse:
    svc = UserService(db, current_user)
    return UserResponse.model_validate(await svc.create_user(body))


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> UserResponse:
    svc = UserService(db, current_user)
    return UserResponse.model_validate(await svc.get_user(user_id))


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID, body: UserAdminUpdate, current_user: CurrentUser, db: DbSession
) -> UserResponse:
    svc = UserService(db, current_user)
    return UserResponse.model_validate(await svc.update_user(user_id, body))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    svc = UserService(db, current_user)
    await svc.delete_user(user_id)
