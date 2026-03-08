"""
Auth API routes: login, refresh, logout, API keys.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser, DbSession
from app.models.api_key import APIKey
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.redis_client import get_redis_client
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ---------------------------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    org_id: uuid.UUID

    model_config = {"from_attributes": True}


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"


class CreateAPIKeyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    scopes: list[str] = Field(default_factory=lambda: ["*"])


class CreateAPIKeyResponse(BaseModel):
    key_id: uuid.UUID
    key_prefix: str
    api_key: str = Field(description="Shown only once — store immediately")
    name: str
    scopes: list[str]


class APIKeyListItem(BaseModel):
    id: uuid.UUID
    name: str
    key_prefix: str
    scopes: list[str]
    last_used_at: datetime | None
    expires_at: datetime | None
    is_active: bool

    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    org_name: str = Field(min_length=1, max_length=255)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: DbSession) -> LoginResponse:
    """Register a new organization + admin user."""
    auth_service = AuthService(db)

    # Ensure email not already taken
    existing = await db.execute(select(User).where(User.email == body.email.lower()))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Email already registered.")

    # Create organization
    slug = body.org_name.lower().replace(" ", "-")[:100]
    org = Organization(name=body.org_name, slug=slug)
    db.add(org)
    await db.flush()

    # Create admin user
    user = User(
        org_id=org.id,
        email=body.email.lower(),
        hashed_password=AuthService.hash_password(body.password),
        role=UserRole.ADMIN,
    )
    db.add(user)
    await db.flush()

    access_token = AuthService.create_access_token(user.id, org.id, user.role.value)
    refresh_token = AuthService.create_refresh_token(user.id)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: DbSession) -> LoginResponse:
    """Authenticate with email + password, receive JWT tokens."""
    auth_service = AuthService(db)
    user = await auth_service.authenticate_user(body.email, body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated.")

    # Update last_login
    user.last_login = datetime.now(timezone.utc)
    await db.flush()

    access_token = AuthService.create_access_token(user.id, user.org_id, user.role.value)
    refresh_token = AuthService.create_refresh_token(user.id)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(body: RefreshRequest, db: DbSession) -> RefreshResponse:
    """Exchange a valid refresh token for a new access token."""
    auth_service = AuthService(db)
    payload = AuthService.decode_token(body.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token.")

    # Check not revoked in Redis
    jti: str | None = payload.get("jti")
    if jti:
        redis = await get_redis_client()
        if await redis.get(f"revoked_jti:{jti}"):
            raise HTTPException(status_code=401, detail="Refresh token revoked.")

    user_id = uuid.UUID(payload["sub"])
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found.")

    access_token = AuthService.create_access_token(user.id, user.org_id, user.role.value)
    return RefreshResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(body: RefreshRequest) -> dict[str, str]:
    """Revoke a refresh token by adding its JTI to Redis blocklist."""
    payload = AuthService.decode_token(body.refresh_token)
    if payload and (jti := payload.get("jti")):
        redis = await get_redis_client()
        ttl = max(int((payload["exp"] - datetime.now(timezone.utc).timestamp())), 0)
        await redis.setex(f"revoked_jti:{jti}", ttl, "1")
    return {"status": "logged_out"}


@router.post("/api-keys", response_model=CreateAPIKeyResponse, status_code=201)
async def create_api_key(
    body: CreateAPIKeyRequest, current_user: CurrentUser, db: DbSession
) -> CreateAPIKeyResponse:
    """Create a new API key. Raw key is returned ONCE — store immediately."""
    auth_service = AuthService(db)
    raw_key, api_key_model = await auth_service.create_api_key(
        user_id=current_user.id,
        org_id=current_user.org_id,
        name=body.name,
        scopes=body.scopes,
    )
    return CreateAPIKeyResponse(
        key_id=api_key_model.id,
        key_prefix=api_key_model.key_prefix,
        api_key=raw_key,
        name=api_key_model.name,
        scopes=api_key_model.scopes,
    )


@router.get("/api-keys", response_model=list[APIKeyListItem])
async def list_api_keys(current_user: CurrentUser, db: DbSession) -> list[APIKeyListItem]:
    """List all active API keys for the current user."""
    result = await db.execute(
        select(APIKey).where(
            APIKey.user_id == current_user.id,
            APIKey.is_deleted.is_(False),
        )
    )
    return [APIKeyListItem.model_validate(k) for k in result.scalars().all()]


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    """Revoke (soft delete) an API key."""
    result = await db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.user_id == current_user.id,
            APIKey.is_deleted.is_(False),
        )
    )
    api_key = result.scalar_one_or_none()
    if api_key is None:
        raise HTTPException(status_code=404, detail="API key not found.")
    api_key.is_deleted = True
    api_key.is_active = False
    await db.flush()
