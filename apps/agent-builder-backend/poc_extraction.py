import asyncio
import sys
import os
import json

# Add monorepo root to path to import packages.skills_framework
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../..")))

if not os.environ.get("OPENAI_API_KEY"):
    print("Warning: OPENAI_API_KEY not set in environment. The script might fail if the mock isn't used.")
    # For POC sake, fake it to avoid immediate crash on ChatOpenAI init
    os.environ["OPENAI_API_KEY"] = "APIKEYHERE"


from packages.skills_framework.executor import SkillExecutor

SKILL_PROMPT = """You are an expert data extraction assistant for emergency services.
Extract information from the provided text into the exact JSON schema requested.
Use the glossary terms to understand domain-specific words.
If a required field is explicitly missing or unknown, leave it as null.

Context Language: {language}
Target Schema: {template_schema}
Glossary: {glossary}

Here are some examples of how to extract the data:
{examples}

Input Text:
"""

TEMPLATE_DATA = {
    "language": "he",
    "fields": [
        {"name": "event_type", "type": "string", "description": "Type of emergency (e.g., fire, medical, police)", "required": True},
        {"name": "location", "type": "string", "description": "Address or description of the location", "required": True},
        {"name": "casualties", "type": "integer", "description": "Number of injured people mentioned. Output 0 if none.", "required": False},
        {"name": "severity", "type": "string", "description": "Severity level: low, medium, high, critical", "required": False},
        {"name": "reporting_unit", "type": "string", "description": "The unit calling in the report", "required": True}
    ],
    "glossary_terms": [
        {"term": "פחע", "meaning": "hostile terrorist activity", "aliases": ["פיגוע", "מחבל"]},
        {"term": "תאונת דרכים", "meaning": "car accident", "aliases": ["תד", "התהפכות"]},
        {"term": "מדא", "meaning": "Magen David Adom (ambulance)", "aliases": ["אמבולנס", "נטן"]}
    ],
    "few_shot_examples": [
        {
            "input": "כאן ניידת 12, יש לנו תד קשה ברחוב הרצל 45, נראה שיש 2 פצועים, תזמינו מדא דחוף",
            "output": {
                "event_type": "car accident",
                "location": "רחוב הרצל 45",
                "casualties": 2,
                "severity": "high",
                "reporting_unit": "ניידת 12"
            }
        }
    ]
}

async def run_extraction(text: str):
    executor = SkillExecutor()
    parameters = {"model": "gpt-4o-mini", "temperature": 0.0}
    
    print(f"\n{'='*60}")
    print(f"Unstructured Input:")
    print(f"'{text}'")
    print(f"{'-'*60}")
    
    result = await executor.execute(
        skill_prompt=SKILL_PROMPT,
        parameters=parameters,
        template_data=TEMPLATE_DATA,
        user_input=text
    )
    
    if result.get("success"):
        print("Structured JSON Output:")
        print(json.dumps(result["output"], indent=2, ensure_ascii=False))
        
        # Simple validation just to show what would happen
        required_fields = [f["name"] for f in TEMPLATE_DATA["fields"] if f.get("required")]
        missing = []
        if isinstance(result["output"], dict):
            for req in required_fields:
                if req not in result["output"] or not result["output"][req]:
                    missing.append(req)
        
        confidence = 1.0 - (len(missing) / len(TEMPLATE_DATA["fields"]))
        print(f"\nConfidence Score: {confidence * 100:.1f}%")
        if missing:
            print(f"Missing Required Fields: {missing}")
    else:
        print(f"Error: {result.get('error')}")
        
    return result

async def main():
    print("Starting Standalone Template Extraction POC...")
    test_inputs = [
        "דיווח מניידת סיור עירוני 4, יש פחע בצומת מורשה, המון פצועים נראה לי אולי 5 אנשים, זה קריטי תביאו כוחות",
        "כאן כבאית 22, הגענו לשריפה ברחוב אלנבי 10, אין נפגעים, מצב בשליטה",
        "מדברים מהמוקד, תדמו דיווח חלקי, רק אומרים שיש תאונה קטנה בים" # missing reporting unit
    ]
    
    for t in test_inputs:
        await run_extraction(t)

if __name__ == "__main__":
    asyncio.run(main())
