"""
Guardrails Service - Comprehensive safety and compliance checking
"""

import os
import re
from typing import Dict, Any, List

from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

from enums.guardrails import GuardrailSeverity
from models.guardrails import GuardrailResult


class GuardrailService:
    """
    Comprehensive guardrail service for input/output validation
    """

    def __init__(self):
        # Initialize PII detection engines
        self.pii_analyzer = AnalyzerEngine()
        self.pii_anonymizer = AnonymizerEngine()

        # OpenAI client for moderation
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        model_name = "unitary/toxic-bert"  # or another toxicity detection model
        self.moderation_pipeline = pipeline(
            "text-classification",
            model=model_name,
            device=0 if torch.cuda.is_available() else -1
        )

    async def check_all_guardrails(
        self, text: str, guardrails: List[Dict[str, Any]], context: str = "input"
    ) -> List[GuardrailResult]:
        """
        Run all enabled guardrails

        Args:
            text: Text to check
            guardrails: List of guardrail configurations
            context: "input" or "output"
        """
        results = []

        for guardrail in guardrails:
            if not guardrail.get("enabled", True):
                continue

            guardrail_type = guardrail["type"]
            config = guardrail.get("config", {})

            if guardrail_type == "input_content_filter" and context == "input":
                result = await self.check_content_policy(text)
                results.append(result)

            elif guardrail_type == "output_content_filter" and context == "output":
                result = await self.check_content_policy(text)
                results.append(result)

            elif guardrail_type == "pii_detection":
                result = await self.detect_pii(text, config)
                results.append(result)

            elif guardrail_type == "prompt_injection" and context == "input":
                result = await self.check_prompt_injection(text)
                results.append(result)

        return results

    async def check_content_policy(self, text: str) -> GuardrailResult:
        """
        Check text against OpenAI moderation API

        Args:
            text: Text to moderate

        Returns:
            GuardrailResult with moderation results
        """
        if not self.openai_api_key:
            return GuardrailResult(
                passed=True,
                violations=[],
                severity=GuardrailSeverity.NONE,
                details={"note": "OpenAI API key not configured"},
            )

        try:
            results = self.moderation_pipeline(text, top_k=None)

            violations = []
            max_score = 0

            for result in results:
                if result["score"] > 0.7:  # Threshold for flagging
                    violations.append(result["label"])
                    max_score = max(max_score, result["score"])

            if violations:
                # Map severity based on scores
                severity = GuardrailSeverity.MEDIUM
                if max_score > 0.9:
                    severity = GuardrailSeverity.CRITICAL
                elif max_score > 0.8:
                    severity = GuardrailSeverity.HIGH

                return GuardrailResult(
                    passed=False,
                    violations=violations,
                    severity=severity,
                    details={"scores": results},
                )

            return GuardrailResult(
                passed=True, violations=[], severity=GuardrailSeverity.NONE
            )

        except Exception as e:
            return GuardrailResult(
                passed=True,
                violations=[],
                severity=GuardrailSeverity.NONE,
                details={"error": f"Moderation model unavailable: {str(e)}"},
            )

    async def detect_pii(self, text: str, config: Dict[str, Any]) -> GuardrailResult:
        """
        Detect and optionally redact PII using Presidio

        Args:
            text: Text to analyze
            config: Configuration with detection options

        Returns:
            GuardrailResult with PII detection results
        """
        # Configure which PII types to detect
        entities_to_detect = []
        if config.get("detect_email", True):
            entities_to_detect.append("EMAIL_ADDRESS")
        if config.get("detect_phone", True):
            entities_to_detect.append("PHONE_NUMBER")
        if config.get("detect_ssn", True):
            entities_to_detect.append("US_SSN")
        if config.get("detect_credit_card", True):
            entities_to_detect.append("CREDIT_CARD")
        if config.get("detect_person", True):
            entities_to_detect.append("PERSON")

        # Analyze text
        results = self.pii_analyzer.analyze(
            text=text,
            entities=entities_to_detect if entities_to_detect else None,
            language="en",
        )

        if not results:
            return GuardrailResult(
                passed=True, violations=[], severity=GuardrailSeverity.NONE
            )

        # Extract detected PII types
        detected_types = list(set([r.entity_type for r in results]))

        # Redact if configured
        redacted_text = None
        if config.get("redact", False):
            anonymized = self.pii_anonymizer.anonymize(
                text=text, analyzer_results=results
            )
            redacted_text = anonymized.text

        # Determine severity
        severity = GuardrailSeverity.MEDIUM
        if any(t in detected_types for t in ["US_SSN", "CREDIT_CARD"]):
            severity = GuardrailSeverity.HIGH

        return GuardrailResult(
            passed=False if config.get("fail_on_detection", True) else True,
            violations=detected_types,
            severity=severity,
            details={
                "count": len(results),
                "detected_entities": [
                    {
                        "type": r.entity_type,
                        "start": r.start,
                        "end": r.end,
                        "score": r.score,
                    }
                    for r in results
                ],
            },
            redacted_text=redacted_text,
        )

    async def check_prompt_injection(self, text: str) -> GuardrailResult:
        """
        Detect potential prompt injection attempts

        Args:
            text: User input to check

        Returns:
            GuardrailResult indicating if injection detected
        """
        # Known injection patterns
        injection_patterns = [
            # Direct instruction override
            (
                r"ignore (all )?previous (instructions?|prompts?)",
                GuardrailSeverity.CRITICAL,
            ),
            (r"disregard (all )?previous", GuardrailSeverity.CRITICAL),
            (r"forget (everything|all)", GuardrailSeverity.CRITICAL),
            (r"new instructions?:", GuardrailSeverity.CRITICAL),
            # System prompt manipulation
            (r"(system|assistant):\s*", GuardrailSeverity.HIGH),
            (r"<\|im_start\|>", GuardrailSeverity.HIGH),
            (r"<\|im_end\|>", GuardrailSeverity.HIGH),
            # Role confusion
            (r"you are (now |actually )?a", GuardrailSeverity.MEDIUM),
            (r"act as (a |an )", GuardrailSeverity.MEDIUM),
            (r"pretend (you are|to be)", GuardrailSeverity.MEDIUM),
            # Jailbreak attempts
            (r"DAN mode", GuardrailSeverity.CRITICAL),
            (r"developer mode", GuardrailSeverity.HIGH),
            (r"bypass (all )?restrictions?", GuardrailSeverity.CRITICAL),
            # Encoding attacks
            (r"base64:", GuardrailSeverity.MEDIUM),
            (r"rot13", GuardrailSeverity.MEDIUM),
            (r"\\x[0-9a-fA-F]{2}", GuardrailSeverity.MEDIUM),
        ]

        violations = []
        max_severity = GuardrailSeverity.NONE

        for pattern, severity in injection_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                violations.append(f"Matched pattern: {pattern}")
                if self._severity_level(severity) > self._severity_level(max_severity):
                    max_severity = severity

        if violations:
            return GuardrailResult(
                passed=False,
                violations=violations,
                severity=max_severity,
                details={"matched_patterns": len(violations)},
            )

        return GuardrailResult(
            passed=True, violations=[], severity=GuardrailSeverity.NONE
        )

    def _severity_level(self, severity: GuardrailSeverity) -> int:
        """Convert severity to numeric level for comparison"""
        levels = {
            GuardrailSeverity.NONE: 0,
            GuardrailSeverity.LOW: 1,
            GuardrailSeverity.MEDIUM: 2,
            GuardrailSeverity.HIGH: 3,
            GuardrailSeverity.CRITICAL: 4,
        }
        return levels.get(severity, 0)

    async def check_token_limit(self, text: str, limit: int) -> GuardrailResult:
        """
        Check if text exceeds token limit

        Args:
            text: Text to check
            limit: Maximum allowed tokens

        Returns:
            GuardrailResult
        """
        # Rough token estimation (1 token ≈ 4 characters)
        estimated_tokens = len(text) // 4

        if estimated_tokens > limit:
            return GuardrailResult(
                passed=False,
                violations=["token_limit_exceeded"],
                severity=GuardrailSeverity.MEDIUM,
                details={
                    "estimated_tokens": estimated_tokens,
                    "limit": limit,
                    "excess": estimated_tokens - limit,
                },
            )

        return GuardrailResult(
            passed=True,
            violations=[],
            severity=GuardrailSeverity.NONE,
            details={"estimated_tokens": estimated_tokens, "limit": limit},
        )

    async def check_cost_limit(
        self, estimated_cost: float, limit: float
    ) -> GuardrailResult:
        """
        Check if operation would exceed cost limit

        Args:
            estimated_cost: Estimated cost in USD
            limit: Maximum allowed cost

        Returns:
            GuardrailResult
        """
        if estimated_cost > limit:
            return GuardrailResult(
                passed=False,
                violations=["cost_limit_exceeded"],
                severity=GuardrailSeverity.HIGH,
                details={
                    "estimated_cost": estimated_cost,
                    "limit": limit,
                    "excess": estimated_cost - limit,
                },
            )

        return GuardrailResult(
            passed=True,
            violations=[],
            severity=GuardrailSeverity.NONE,
            details={"estimated_cost": estimated_cost, "limit": limit},
        )


# Global instance
guardrail_service = GuardrailService()
