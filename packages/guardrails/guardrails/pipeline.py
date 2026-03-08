"""
Guardrail Pipeline logic using Microsoft Presidio for PII detection.
"""
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

class GuardrailPipeline:
    def __init__(self):
        self.analyzer = AnalyzerEngine()
        self.anonymizer = AnonymizerEngine()

    def check_pii(self, text: str) -> bool:
        """Returns True if PII is detected in the text text."""
        results = self.analyzer.analyze(text=text, entities=["PHONE_NUMBER", "EMAIL_ADDRESS", "CREDIT_CARD"], language="en")
        return len(results) > 0

    def redact_pii(self, text: str) -> str:
        """Removes PII from text."""
        results = self.analyzer.analyze(text=text, entities=["PHONE_NUMBER", "EMAIL_ADDRESS", "CREDIT_CARD"], language="en")
        anonymized_result = self.anonymizer.anonymize(text=text, analyzer_results=results)
        return anonymized_result.text
