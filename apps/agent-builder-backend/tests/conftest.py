"""
conftest.py — pytest fixtures for the full Agent Builder test suite.

Provides:
  - async SQLAlchemy test session (in-memory SQLite)
  - FastAPI TestClient (sync) and AsyncClient (async)
  - Pre-built user, org, blueprint, execution fixtures
  - Auth token helpers
  - Redis mock
"""
from __future__ import annotations

import asyncio
import uuid
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app as fastapi_app
from app.models.blueprint import Blueprint, BlueprintStatus, BlueprintType
from app.models.execution import Execution, ExecutionStatus
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.services.auth_service import AuthService

# ── Test DB engine (SQLite in-memory) ────────────────────────────────────────────

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)
TestSessionFactory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


@pytest_asyncio.fixture(scope="session")
def event_loop():
    """Session-scoped event loop."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    """Create all tables once per session."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Function-scoped DB session that rolls back after each test."""
    async with TestSessionFactory() as session:
        async with session.begin():
            yield session
            await session.rollback()


# ── Override DB dependency ────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """HTTPX async client with DB + Redis mocked."""

    async def _override_db():
        yield db_session

    fastapi_app.dependency_overrides[get_db] = _override_db

    with patch("app.redis_client.get_redis_client") as mock_redis:
        mock_redis.return_value = AsyncMock()
        async with AsyncClient(
            transport=ASGITransport(app=fastapi_app),
            base_url="http://test",
        ) as ac:
            yield ac

    fastapi_app.dependency_overrides.clear()


# ── Helper factories ──────────────────────────────────────────────────────────────

def make_org() -> Organization:
    return Organization(
        id=uuid.uuid4(),
        name="Test Org",
        slug="test-org",
    )


def make_user(org: Organization, role: UserRole = UserRole.BUILDER) -> User:
    from app.services.auth_service import AuthService as _AS
    hashed = _AS.hash_password("Password123!")
    return User(
        id=uuid.uuid4(),
        org_id=org.id,
        email=f"user-{uuid.uuid4().hex[:6]}@test.com",
        hashed_password=hashed,
        role=role,
        is_active=True,
    )


async def create_user_and_org(
    db: AsyncSession,
    role: UserRole = UserRole.BUILDER,
) -> tuple[User, Organization]:
    org  = make_org()
    user = make_user(org, role)
    db.add(org)
    db.add(user)
    await db.flush()
    return user, org


def minimal_definition() -> dict:
    return {
        "nodes": [
            {"id": "t1", "type": "trigger", "label": "Trigger", "data": {"trigger_type": "manual"}},
            {"id": "l1", "type": "llm", "label": "LLM", "data": {"model": "gpt-4o-mini", "max_tokens": 100, "system_prompt": "Be helpful."}},
            {"id": "o1", "type": "output", "label": "Output", "data": {}},
        ],
        "edges": [
            {"id": "e1", "source": "t1", "target": "l1"},
            {"id": "e2", "source": "l1", "target": "o1"},
        ],
    }


async def create_blueprint(
    db: AsyncSession,
    user: User,
    org: Organization,
    *,
    status: BlueprintStatus = BlueprintStatus.DRAFT,
    name: str = "Test Blueprint",
) -> Blueprint:
    bp = Blueprint(
        org_id=org.id,
        created_by=user.id,
        name=name,
        description="A test blueprint",
        blueprint_type=BlueprintType.WORKFLOW,
        definition=minimal_definition(),
        status=status,
        version=1,
        tags=["test"],
    )
    db.add(bp)
    await db.flush()
    return bp


async def get_auth_token(client: AsyncClient, email: str, password: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return r.json().get("access_token", "")


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Pytest markers ────────────────────────────────────────────────────────────────

def pytest_configure(config):
    config.addinivalue_line("markers", "unit: pure unit tests (no I/O)")
    config.addinivalue_line("markers", "integration: DB + HTTP tests")
    config.addinivalue_line("markers", "e2e: full stack end-to-end tests")
    config.addinivalue_line("markers", "slow: tests that take > 5 seconds")
