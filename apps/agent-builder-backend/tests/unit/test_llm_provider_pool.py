"""
test_unit_llm_provider_pool.py — Unit tests for LLMProviderPool.
Tests failover routing, model selection, and rate-limit handling.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.llm_provider_pool import LLMProviderPool, ProviderConfig

pytestmark = pytest.mark.unit


class TestProviderConfig:

    def test_provider_config_defaults(self):
        cfg = ProviderConfig(provider="openai", model="gpt-4o", api_key="key")
        assert cfg.priority == 1
        assert cfg.weight == 1.0
        assert cfg.max_retries == 2

    def test_provider_config_custom_priority(self):
        cfg = ProviderConfig(provider="anthropic", model="claude-3-5-sonnet", api_key="key", priority=5)
        assert cfg.priority == 5


class TestLLMProviderPool:

    def _make_pool(self, configs: list[ProviderConfig]) -> LLMProviderPool:
        pool = LLMProviderPool(configs=configs)
        return pool

    def test_pool_init_with_empty_configs_raises(self):
        with pytest.raises((ValueError, Exception)):
            LLMProviderPool(configs=[])

    def test_pool_selects_provider_by_priority(self):
        configs = [
            ProviderConfig(provider="openai",    model="gpt-4o",       api_key="k1", priority=1),
            ProviderConfig(provider="anthropic", model="claude-3-5",   api_key="k2", priority=2),
        ]
        pool = self._make_pool(configs)
        # Primary provider (lowest priority number = highest priority)
        primary = pool.get_primary()
        assert primary.provider == "openai"

    def test_pool_get_fallback_returns_secondary(self):
        configs = [
            ProviderConfig(provider="openai",    model="gpt-4o",   api_key="k1", priority=1),
            ProviderConfig(provider="anthropic", model="claude",   api_key="k2", priority=2),
        ]
        pool = self._make_pool(configs)
        fallbacks = pool.get_fallbacks()
        assert len(fallbacks) >= 1
        assert fallbacks[0].provider == "anthropic"

    @pytest.mark.asyncio
    async def test_invoke_uses_primary_on_success(self):
        configs = [ProviderConfig(provider="openai", model="gpt-4o-mini", api_key="key")]
        pool = self._make_pool(configs)
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = MagicMock(content="Hello!")

        with patch.object(pool, "_build_llm", return_value=mock_llm):
            result = await pool.ainvoke(messages=["test"])
            mock_llm.ainvoke.assert_called_once()
            assert result.content == "Hello!"

    @pytest.mark.asyncio
    async def test_invoke_falls_back_on_primary_failure(self):
        configs = [
            ProviderConfig(provider="openai",    model="gpt-4o", api_key="k1", priority=1),
            ProviderConfig(provider="anthropic", model="claude", api_key="k2", priority=2),
        ]
        pool = self._make_pool(configs)

        primary_llm  = AsyncMock()
        fallback_llm = AsyncMock()
        primary_llm.ainvoke.side_effect = Exception("Rate limited")
        fallback_llm.ainvoke.return_value = MagicMock(content="Fallback response")

        call_count = [0]
        async def _build_mock(cfg):
            call_count[0] += 1
            return primary_llm if cfg.provider == "openai" else fallback_llm

        with patch.object(pool, "_build_llm", side_effect=lambda cfg: (
            primary_llm if cfg.provider == "openai" else fallback_llm
        )):
            result = await pool.ainvoke(messages=["test"])
            assert result.content == "Fallback response"
            assert primary_llm.ainvoke.called

    @pytest.mark.asyncio
    async def test_all_providers_fail_raises(self):
        configs = [ProviderConfig(provider="openai", model="gpt-4o", api_key="key")]
        pool = self._make_pool(configs)
        mock_llm = AsyncMock()
        mock_llm.ainvoke.side_effect = Exception("Total failure")

        with patch.object(pool, "_build_llm", return_value=mock_llm):
            with pytest.raises(Exception, match="Total failure|All providers failed"):
                await pool.ainvoke(messages=["test"])


class TestModelCostMap:

    def test_known_models_have_positive_rates(self):
        from app.services.blueprint_service import _MODEL_COST_MAP
        for model, rate in _MODEL_COST_MAP.items():
            assert rate > 0, f"Model {model} has non-positive rate"

    def test_gpt4o_mini_cheaper_than_gpt4o(self):
        from app.services.blueprint_service import _MODEL_COST_MAP
        assert _MODEL_COST_MAP["gpt-4o-mini"] < _MODEL_COST_MAP["gpt-4o"]
