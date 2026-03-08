"""
test_unit_auth_service.py — Unit tests for AuthService.
Tests password hashing, JWT creation, token verification without HTTP.
"""
from __future__ import annotations

import time
import uuid
from unittest.mock import MagicMock, patch

import pytest
from jose import jwt

from app.services.auth_service import AuthService

pytestmark = pytest.mark.unit

# ── Password hashing ──────────────────────────────────────────────────────────────

class TestPasswordHashing:

    def test_hash_password_returns_different_from_plaintext(self):
        h = AuthService.hash_password("Password123!")
        assert h != "Password123!"

    def test_verify_correct_password(self):
        h = AuthService.hash_password("correct-horse-battery")
        assert AuthService.verify_password("correct-horse-battery", h) is True

    def test_verify_wrong_password(self):
        h = AuthService.hash_password("right-password")
        assert AuthService.verify_password("wrong-password", h) is False

    def test_same_password_different_hashes(self):
        """bcrypt generates different salts each time."""
        h1 = AuthService.hash_password("samepass")
        h2 = AuthService.hash_password("samepass")
        assert h1 != h2
        # But both verify correctly
        assert AuthService.verify_password("samepass", h1) is True
        assert AuthService.verify_password("samepass", h2) is True

    def test_empty_password_hash_verifiable(self):
        """Edge case — empty password should still hash and verify."""
        h = AuthService.hash_password("")
        assert AuthService.verify_password("", h) is True
        assert AuthService.verify_password("not-empty", h) is False


# ── JWT creation ──────────────────────────────────────────────────────────────────

class TestJWTCreation:

    @pytest.fixture
    def mock_settings(self):
        """Patch settings to use simple HMAC for testing (no RSA key files needed)."""
        with patch("app.services.auth_service.settings") as mock:
            mock.JWT_ALGORITHM = "HS256"
            mock.jwt_private_key = "test-secret-key"
            mock.jwt_public_key  = "test-secret-key"
            mock.JWT_ACCESS_TOKEN_EXPIRE_MINUTES  = 15
            mock.JWT_REFRESH_TOKEN_EXPIRE_DAYS    = 7
            yield mock

    def test_access_token_contains_sub(self, mock_settings):
        user_id = uuid.uuid4()
        token = AuthService.create_access_token(str(user_id))
        payload = jwt.decode(token, "test-secret-key", algorithms=["HS256"])
        assert payload["sub"] == str(user_id)

    def test_access_token_has_type_access(self, mock_settings):
        token = AuthService.create_access_token(str(uuid.uuid4()))
        payload = jwt.decode(token, "test-secret-key", algorithms=["HS256"])
        assert payload.get("type") == "access"

    def test_refresh_token_has_type_refresh(self, mock_settings):
        token = AuthService.create_refresh_token(str(uuid.uuid4()))
        payload = jwt.decode(token, "test-secret-key", algorithms=["HS256"])
        assert payload.get("type") == "refresh"

    def test_token_expiry_is_in_future(self, mock_settings):
        token = AuthService.create_access_token(str(uuid.uuid4()))
        payload = jwt.decode(token, "test-secret-key", algorithms=["HS256"])
        assert payload["exp"] > int(time.time())

    def test_access_token_expires_after_15_minutes(self, mock_settings):
        token = AuthService.create_access_token(str(uuid.uuid4()))
        payload = jwt.decode(token, "test-secret-key", algorithms=["HS256"])
        expires_in = payload["exp"] - int(time.time())
        # Should be ≈ 900 seconds (15 min), allow ±5s variance
        assert 890 <= expires_in <= 910

    def test_different_users_get_different_tokens(self, mock_settings):
        t1 = AuthService.create_access_token(str(uuid.uuid4()))
        t2 = AuthService.create_access_token(str(uuid.uuid4()))
        assert t1 != t2


# ── JWT verification ──────────────────────────────────────────────────────────────

class TestJWTVerification:

    @pytest.fixture
    def mock_settings(self):
        with patch("app.services.auth_service.settings") as mock:
            mock.JWT_ALGORITHM = "HS256"
            mock.jwt_private_key = "test-secret"
            mock.jwt_public_key  = "test-secret"
            mock.JWT_ACCESS_TOKEN_EXPIRE_MINUTES  = 15
            mock.JWT_REFRESH_TOKEN_EXPIRE_DAYS    = 7
            yield mock

    def test_decode_valid_token(self, mock_settings):
        user_id = uuid.uuid4()
        token = AuthService.create_access_token(str(user_id))
        payload = AuthService.decode_token(token)
        assert payload["sub"] == str(user_id)

    def test_decode_invalid_token_raises(self, mock_settings):
        from jose import JWTError
        with pytest.raises((JWTError, Exception)):
            AuthService.decode_token("not.a.valid.jwt")

    def test_decode_tampered_token_raises(self, mock_settings):
        from jose import JWTError
        user_id = uuid.uuid4()
        token = AuthService.create_access_token(str(user_id))
        # Tamper with the signature
        parts = token.split(".")
        tampered = f"{parts[0]}.{parts[1]}.invalidsig"
        with pytest.raises((JWTError, Exception)):
            AuthService.decode_token(tampered)
