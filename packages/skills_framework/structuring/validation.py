from typing import List, Optional, Dict, Any

class ValidationEngine:
    """
    Validates extracted data and manages human-in-the-loop triggers.
    """
    
    async def validate(
        self,
        extracted_data: dict,
        schema: dict,
        validation_rules: Optional[dict] = None
    ) -> dict:
        """
        Validate extraction against Schema and rules.
        """
        errors = []
        warnings = []
        missing_fields = []
        
        schema_fields = schema.get("fields", [])
        if isinstance(schema, dict) and "properties" in schema:
            # support standard JSON Schema
            schema_fields = [{"name": k, **v} for k, v in schema["properties"].items()]
            
        for field in schema_fields:
            name = field.get("name")
            required = field.get("required", False)
            
            val = extracted_data.get(name)
            if not val or (isinstance(val, dict) and not val.get("value")):
                if required:
                    missing_fields.append(name)
                    errors.append({"field": name, "message": f"Required field '{name}' is missing."})
                else:
                    warnings.append({"field": name, "message": f"Optional field '{name}' is empty."})
                    
        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "missing_fields": missing_fields
        }
        
    async def generate_clarification_questions(
        self,
        validation_result: dict,
        extracted_data: dict,
        original_message: str
    ) -> List[dict]:
        """
        Generate specific questions for user in Hebrew.
        """
        questions = []
        for missing in validation_result.get("missing_fields", []):
            questions.append({
                "question": f"לא מצאתי מידע לגבי '{missing}'. תוכל לפרט בבקשה?",
                "field_name": missing,
                "suggested_values": [],
                "question_type": "missing"
            })
            
        # Ambiguous checks could go here (e.g. if field confidence is low)
        return questions
        
    async def incorporate_user_response(
        self,
        extracted_data: dict,
        clarification_response: dict
    ) -> dict:
        """Update extracted data with user clarifications"""
        updated = extracted_data.copy()
        for field, value in clarification_response.items():
            updated[field] = {
                "value": value,
                "confidence": 1.0,
                "citation": "User clarification",
                "extraction_method": "human"
            }
        return updated
        
    def calculate_overall_confidence(
        self,
        extracted_data: dict
    ) -> float:
        """
        Calculate confidence score across all fields.
        """
        if not extracted_data:
            return 0.0
            
        total_conf = 0.0
        count = 0
        
        for k, v in extracted_data.items():
            if isinstance(v, dict) and "confidence" in v:
                total_conf += v["confidence"]
                count += 1
                
        if count == 0:
            return 1.0 # Assume valid if no confidence metrics were attached
            
        return total_conf / count
        
    def should_auto_approve(
        self,
        confidence: float,
        validation_result: dict,
        threshold: float = 0.85
    ) -> bool:
        """Determine if extraction is confident enough to skip human review"""
        if not validation_result.get("is_valid", False):
            return False
            
        return confidence >= threshold
