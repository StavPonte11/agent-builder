import re
from typing import List, Optional, Dict, Any

class HebrewNLPProcessor:
    """
    Handles Hebrew-specific NLP tasks with optional RAG integration.
    """
    
    def __init__(self, rag_tool=None, spacy_model: str = "he_core_news_lg"):
        self.rag_tool = rag_tool
        self.spacy_model = spacy_model
        # Lazy load spacy to avoid blocking startup if not installed yet
        self._nlp = None

    def _get_nlp(self):
        if self._nlp is None:
            import spacy
            try:
                self._nlp = spacy.load(self.spacy_model)
            except OSError:
                # If model is not found, fallback to blank or throw helpful error
                print(f"Warning: {self.spacy_model} not found. Returning blank hebrew model for testing.")
                self._nlp = spacy.blank("he")
        return self._nlp
    
    async def normalize_text(self, text: str) -> str:
        """
        Normalize Hebrew text:
        - Remove niqqud
        - Standardize whitespace and punctuation
        """
        # Remove Niqqud (Hebrew vowels)
        normalized = re.sub(r'[\u0591-\u05C7]', '', text)
        # Normalize whitespace
        normalized = " ".join(normalized.split())
        return normalized
    
    async def extract_entities(
        self,
        text: str,
        schema: dict,
        glossary_context: Optional[str] = None
    ) -> dict:
        """
        Extract entities using multi-method approach.
        """
        nlp = self._get_nlp()
        doc = nlp(text)
        
        entities = {}
        # Naive SpaCy entity extraction if available
        for ent in doc.ents:
            entities[ent.label_] = {
                "value": ent.text,
                "confidence": 0.8,
                "citation": ent.text,
                "extraction_method": "ner"
            }
            
        return entities
    
    async def resolve_glossary_terms(
        self,
        text: str,
        known_terms: List[str]
    ) -> dict:
        """
        Find glossary terms in the text and match them to known ones.
        """
        found = {}
        for term in known_terms:
            if term in text:
                found[term] = {
                    "standard_form": term,
                    "synonyms": [],
                    "definition": "Found exact match."
                }
        return found
    
    async def extract_temporal_entities(self, text: str) -> List[dict]:
        """Extract dates, times, durations in Hebrew"""
        # Regex baseline for simple times like HH:MM
        times = re.findall(r'\b(?:[01]\d|2[0-3]):[0-5]\d\b', text)
        results = []
        for t in times:
            results.append({"mention": t, "type": "time", "confidence": 0.9})
        return results
    
    async def extract_location_mentions(self, text: str) -> List[dict]:
        """
        Extract potential location references.
        """
        # Very basic stub; production would use proper NER "LOC" or "GPE" labels
        results = []
        if "צומת" in text or "רחוב" in text or "כביש" in text:
            # simple keyword heuristic
            sentences = text.split('.')
            for s in sentences:
                if "צומת" in s or "רחוב" in s:
                    results.append({"mention": s.strip(), "context": s.strip(), "confidence": 0.7})
        return results
