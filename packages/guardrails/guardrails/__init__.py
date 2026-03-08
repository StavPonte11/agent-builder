"""
Guardrail Pipeline

Runs checks on generated content or input prompts to enforce safety using Presidio.
"""
from .pipeline import GuardrailPipeline

__all__ = ["GuardrailPipeline"]
