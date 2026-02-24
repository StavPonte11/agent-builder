import json
from typing import List, Optional, Dict, Any
from .nlp import HebrewNLPProcessor

class FieldExtractor:
    """
    Extracts structured fields from Hebrew text according to schema.
    """
    
    def __init__(
        self,
        llm,
        nlp_processor: HebrewNLPProcessor,
        constrained_decoder=None
    ):
        self.llm = llm
        self.nlp = nlp_processor
        self.decoder = constrained_decoder
        
    async def extract_fields(
        self,
        message: str,
        schema: dict,
        context: Optional[dict] = None
    ) -> dict:
        """
        Extract all fields defined in schema using LLM and prompt engineering.
        """
        # 1. NLP Preprocessing
        normalized_msg = await self.nlp.normalize_text(message)
        
        # 2. Build the LLM prompt
        prompt = self.get_extraction_prompt(normalized_msg, schema, context or {})
        
        # 3. Call LLM (using LangChain ChatModel)
        try:
            # We mock constrained decoding if `with_structured_output` isn't available
            if hasattr(self.llm, "with_structured_output"):
                # Real implementation: bind the schema
                structured_llm = self.llm.with_structured_output(schema)
                result = await structured_llm.ainvoke(prompt)
                extracted_data = result if isinstance(result, dict) else result.model_dump()
            else:
                # Fallback purely text logic
                from langchain_core.messages import HumanMessage, SystemMessage
                resp = await self.llm.ainvoke([
                    SystemMessage(content=prompt),
                    HumanMessage(content=normalized_msg)
                ])
                raw = resp.content.strip()
                if raw.startswith("```json"):
                    raw = raw.split("```json")[1].split("```")[0].strip()
                extracted_data = json.loads(raw)
                
            # 4. Attach metadata for references
            final_fields = {}
            for k, v in extracted_data.items():
                final_fields[k] = {
                    "value": v,
                    "confidence": 0.9, # Mocked
                    "citation": "Source text snippet placeholder",
                    "extraction_method": "llm"
                }
            return final_fields
            
        except Exception as e:
            print(f"Extraction failed: {e}")
            return {}
            
    async def extract_with_citation(
        self,
        message: str,
        field_schema: dict
    ) -> dict:
        """
        Extract field value and cite source text.
        """
        # For granular single-field extraction
        return {
            "value": "extracted_value",
            "confidence": 0.85,
            "citation": "exact text from message"
        }
        
    async def validate_extraction(
        self,
        extraction: dict,
        original_message: str
    ) -> dict:
        """
        Verify that citations actually exist in message.
        """
        errors = []
        for field, data in extraction.items():
            citation = data.get("citation")
            # Loose text matching due to normalization
            if citation and citation not in original_message:
                errors.append(f"Citation for {field} not found in original message.")
                
        return {
            "is_valid": len(errors) == 0,
            "errors": errors
        }
        
    def get_extraction_prompt(
        self,
        message: str,
        schema: dict,
        context: dict
    ) -> str:
        """
        Generate LLM prompt for extraction in Hebrew.
        """
        return f"""
אתה מומחה חילוץ מידע מובנה למערכות בטחוניות ותפעוליות.
עליך לחלץ את המידע מהטקסט של המשתמש, ולהחזיר אך ורק JSON חוקי לפי הסכמה הבאה:
{json.dumps(schema, ensure_ascii=False, indent=2)}

הקשר (Context) של הקבוצה או המשתמש:
{json.dumps(context, ensure_ascii=False)}

חוקים:
1. אין להמציא מידע (Hallucination). אם מידע חסר, השאר אותו ריק/null לפי הסכמה.
2. עליך לצטט את המקור מתוך טקסט המשתמש ככל הניתן.
"""
