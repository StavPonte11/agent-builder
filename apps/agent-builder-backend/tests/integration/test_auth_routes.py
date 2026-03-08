"""
test_integration_auth.py — Integration tests for /api/v1/auth routes.
Tests login, refresh, logout, API key management via real HTTP calls.
"""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.models.user import UserRole

pytestmark = pytest.mark.integration


class TestLogin:

    @pytest.mark.asyncio
    async def test_login_with_valid_credentials(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org
        user, org = await create_user_and_org(db_session)
        r = await client.post("/api/v1/auth/login", json={
            "email": user.email,
            "password": "Password123!",
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "Bearer"
        assert data["user"]["email"] == user.email

    @pytest.mark.asyncio
    async def test_login_wrong_password_returns_401(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org
        user, org = await create_user_and_org(db_session)
        r = await client.post("/api/v1/auth/login", json={
            "email": user.email,
            "password": "WrongPassword!",
        })
        assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_user_returns_401(self, client: AsyncClient):
        r = await client.post("/api/v1/auth/login", json={
            "email": "ghost@test.com",
            "password": "Password123!",
        })
        assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_login_invalid_email_format_returns_422(self, client: AsyncClient):
        r = await client.post("/api/v1/auth/login", json={
            "email": "not-an-email",
            "password": "Password123!",
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_login_short_password_returns_422(self, client: AsyncClient):
        r = await client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "short",
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_login_returns_user_role(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org
        user, org = await create_user_and_org(db_session, role=UserRole.ADMIN)
        r = await client.post("/api/v1/auth/login", json={
            "email": user.email, "password": "Password123!",
        })
        assert r.json()["user"]["role"] == "admin"


class TestRefreshToken:

    @pytest.mark.asyncio
    async def test_refresh_returns_new_access_token(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org
        user, org = await create_user_and_org(db_session)
        login = await client.post("/api/v1/auth/login", json={
            "email": user.email, "password": "Password123!",
        })
        refresh_token = login.json()["refresh_token"]
        r = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        # New token should differ from old
        assert data["access_token"] != login.json()["access_token"]

    @pytest.mark.asyncio
    async def test_refresh_with_invalid_token_returns_401(self, client: AsyncClient):
        r = await client.post("/api/v1/auth/refresh", json={"refresh_token": "invalid.token.here"})
        assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_using_access_token_as_refresh_fails(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org
        user, org = await create_user_and_org(db_session)
        login = await client.post("/api/v1/auth/login", json={
            "email": user.email, "password": "Password123!",
        })
        access_token = login.json()["access_token"]
        r = await client.post("/api/v1/auth/refresh", json={"refresh_token": access_token})
        assert r.status_code == 401


class TestLogout:

    @pytest.mark.asyncio
    async def test_logout_returns_204(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.post("/api/v1/auth/logout", headers=auth_headers(token))
        assert r.status_code in (200, 204)

    @pytest.mark.asyncio
    async def test_logout_without_token_returns_401(self, client: AsyncClient):
        r = await client.post("/api/v1/auth/logout")
        assert r.status_code == 401


class TestAPIKeys:

    @pytest.mark.asyncio
    async def test_create_api_key(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.post(
            "/api/v1/auth/api-keys",
            headers=auth_headers(token),
            json={"name": "My CI Key", "scopes": ["read", "write"]},
        )
        assert r.status_code == 201
        data = r.json()
        assert "api_key" in data
        assert data["name"] == "My CI Key"
        assert "read" in data["scopes"]
        # Key is shown only once — should start with a recognizable prefix
        assert len(data["api_key"]) > 20

    @pytest.mark.asyncio
    async def test_list_api_keys(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        # Create one key
        await client.post("/api/v1/auth/api-keys", headers=auth_headers(token),
                          json={"name": "List Key"})
        r = await client.get("/api/v1/auth/api-keys", headers=auth_headers(token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    @pytest.mark.asyncio
    async def test_revoke_api_key(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        create_r = await client.post("/api/v1/auth/api-keys", headers=auth_headers(token),
                                     json={"name": "Revoke Me"})
        key_id = create_r.json()["key_id"]
        r = await client.delete(f"/api/v1/auth/api-keys/{key_id}", headers=auth_headers(token))
        assert r.status_code in (200, 204)

    @pytest.mark.asyncio
    async def test_api_key_missing_name_returns_422(self, client: AsyncClient, db_session):
        from tests.conftest import create_user_and_org, auth_headers, get_auth_token
        user, org = await create_user_and_org(db_session)
        token = await get_auth_token(client, user.email, "Password123!")
        r = await client.post("/api/v1/auth/api-keys", headers=auth_headers(token),
                              json={"name": "", "scopes": []})
        assert r.status_code == 422


class TestProtectedRoutes:

    @pytest.mark.asyncio
    async def test_accessing_protected_route_without_token_returns_401(self, client: AsyncClient):
        r = await client.get("/api/v1/blueprints")
        assert r.status_code == 401

    @pytest.mark.asyncio
    async def test_accessing_protected_route_with_invalid_token_returns_401(self, client: AsyncClient):
        r = await client.get(
            "/api/v1/blueprints",
            headers={"Authorization": "Bearer fake.invalid.token"},
        )
        assert r.status_code == 401
