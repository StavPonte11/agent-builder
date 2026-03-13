"""
LLM Provider Pool — Ordered failover across OpenAI, Anthropic, Google.
On rate-limit or provider error, switches to the next available provider.
"""
from __future__ import annotations

import os
import re
import json
from typing import Any, Dict, List, Optional


PRICING_TABLE: Dict[str, Dict[str, float]] = {
    "gpt-4o":                           {"input": 0.0025,  "output": 0.010},
    "gpt-4o-mini":                      {"input": 0.00015, "output": 0.0006},
    "o1":                               {"input": 0.015,   "output": 0.060},
    "o3-mini":                          {"input": 0.0011,  "output": 0.0044},
    "claude-3-7-sonnet-20250219":       {"input": 0.003,   "output": 0.015},
    "claude-3-5-sonnet-20241022":       {"input": 0.003,   "output": 0.015},
    "claude-3-5-haiku-20241022":        {"input": 0.0008,  "output": 0.004},
    "claude-3-opus-20240229":           {"input": 0.015,   "output": 0.075},
    "gemini-2.0-flash":                 {"input": 0.00010, "output": 0.00040},
    "gemini-1.5-pro":                   {"input": 0.00125, "output": 0.005},
}


def _detect_provider(model: str) -> str:
    if model.startswith("gpt") or model.startswith("o1") or model.startswith("o3"):
        return "openai"
    if model.startswith("claude"):
        return "anthropic"
    if model.startswith("gemini"):
        return "google"
    return "openai"


class LLMProviderPool:
    """
    Manages ordered LLM providers with automatic failover.
    Reads multiple API keys per provider from environment variables.
    """

    def __init__(self, override_keys: Optional[Dict[str, str]] = None):
        self._openai_keys = self._collect_keys("OPENAI_API_KEY")
        self._anthropic_keys = self._collect_keys("ANTHROPIC_API_KEY")
        self._google_keys = self._collect_keys("GOOGLE_API_KEY")
        self._override_keys = override_keys or {}

    def _collect_keys(self, base_var: str) -> List[str]:
        """Collects KEY, KEY_2, KEY_3, ... from environment."""
        keys = []
        base = os.environ.get(base_var)
        if base:
            keys.append(base)
        i = 2
        while True:
            alt = os.environ.get(f"{base_var}_{i}")
            if not alt:
                break
            keys.append(alt)
            i += 1
        return keys

    def _best_available_model(self) -> tuple[str, str]:
        """Return the best (model, provider) tuple based on available keys."""
        if self._google_keys:
            return "gemini-2.0-flash", "google"
        if self._anthropic_keys:
            return "claude-3-5-haiku-20241022", "anthropic"
        if self._openai_keys:
            return "gpt-4o-mini", "openai"
        raise RuntimeError("No LLM API keys configured. Set GOOGLE_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY.")

    def call(
        self,
        model: str,
        system: str,
        user: str,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        output_schema: Optional[str] = None,
        stream: bool = False,
        override_keys: Optional[Dict[str, str]] = None,
    ) -> str:
        """
        Call the LLM with automatic failover across providers/keys.
        If the requested model's provider has no key, falls back to the best available provider.
        If override_keys (like Org BYOK) are provided, they take priority.
        Returns the text response.
        """
        provider = _detect_provider(model)

        # Build priority key lists
        openai_keys = []
        anthropic_keys = []
        google_keys = []
        
        if override_keys is None:
            override_keys = self._override_keys
            
        if override_keys:
            if override_keys.get("OPENAI_API_KEY"): openai_keys.append(override_keys["OPENAI_API_KEY"])
            if override_keys.get("ANTHROPIC_API_KEY"): anthropic_keys.append(override_keys["ANTHROPIC_API_KEY"])
            if override_keys.get("GOOGLE_API_KEY"): google_keys.append(override_keys["GOOGLE_API_KEY"])
            
        openai_keys.extend(self._openai_keys)
        anthropic_keys.extend(self._anthropic_keys)
        google_keys.extend(self._google_keys)

        # Auto-fallback: if the ideal provider has no keys, use what's available
        if provider == "openai" and not openai_keys:
            fallback_model, provider = self._best_available_model()
            if provider == "google":
                model = fallback_model
            elif provider == "anthropic":
                model = fallback_model
        elif provider == "anthropic" and not anthropic_keys:
            fallback_model, provider = self._best_available_model()
            model = fallback_model
        elif provider == "google" and not google_keys:
            fallback_model, provider = self._best_available_model()
            model = fallback_model

        if provider == "openai":
            return self._call_openai(model, system, user, max_tokens, temperature, output_schema, openai_keys)
        elif provider == "anthropic":
            return self._call_anthropic(model, system, user, max_tokens, temperature, output_schema, anthropic_keys)
        elif provider == "google":
            return self._call_google(model, system, user, max_tokens, temperature, google_keys)
        else:
            raise ValueError(f"Unknown provider for model: {model}")


    def _call_openai(self, model, system, user, max_tokens, temperature, output_schema, keys) -> str:
        last_err = None
        for api_key in keys:
            try:
                import openai
                client = openai.OpenAI(api_key=api_key)
                messages = []
                if system:
                    messages.append({"role": "system", "content": system})
                messages.append({"role": "user", "content": user})

                if output_schema:
                    # Structured output
                    try:
                        schema = json.loads(output_schema)
                        resp = client.chat.completions.create(
                            model=model,
                            messages=messages,
                            max_tokens=max_tokens,
                            temperature=temperature,
                            response_format={"type": "json_object"},
                        )
                    except (json.JSONDecodeError, Exception):
                        resp = client.chat.completions.create(
                            model=model, messages=messages,
                            max_tokens=max_tokens, temperature=temperature,
                        )
                else:
                    resp = client.chat.completions.create(
                        model=model, messages=messages,
                        max_tokens=max_tokens, temperature=temperature,
                    )
                return resp.choices[0].message.content or ""
            except Exception as e:
                last_err = e
                err_name = type(e).__name__
                if "RateLimit" in err_name or "Quota" in err_name:
                    continue  # Try next key
                raise e
        raise last_err or RuntimeError("No OpenAI keys available")

    def _call_anthropic(self, model, system, user, max_tokens, temperature, output_schema, keys) -> str:
        last_err = None
        for api_key in keys:
            try:
                import anthropic
                client = anthropic.Anthropic(api_key=api_key)

                kwargs: Dict[str, Any] = {
                    "model": model,
                    "max_tokens": max_tokens,
                    "messages": [{"role": "user", "content": user}],
                }
                if system:
                    kwargs["system"] = system
                if temperature is not None:
                    kwargs["temperature"] = temperature

                resp = client.messages.create(**kwargs)
                return resp.content[0].text if resp.content else ""
            except Exception as e:
                last_err = e
                err_str = str(e).lower()
                if "rate_limit" in err_str or "overloaded" in err_str:
                    continue
                raise e
        raise last_err or RuntimeError("No Anthropic keys available")

    def _call_google(self, model, system, user, max_tokens, temperature, keys) -> str:
        last_err = None
        for api_key in keys:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                gmodel = genai.GenerativeModel(
                    model_name=model,
                    system_instruction=system or None,
                )
                resp = gmodel.generate_content(
                    user,
                    generation_config=genai.types.GenerationConfig(
                        max_output_tokens=max_tokens,
                        temperature=temperature,
                    )
                )
                return resp.text or ""
            except Exception as e:
                last_err = e
                continue
        raise last_err or RuntimeError("No Google API keys available")

    def compute_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        costs = PRICING_TABLE.get(model, {"input": 0.002, "output": 0.008})
        return (prompt_tokens / 1000) * costs["input"] + (completion_tokens / 1000) * costs["output"]
