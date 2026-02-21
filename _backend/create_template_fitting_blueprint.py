import requests
import json

url = "http://localhost:8000/api/blueprints"
data = {
    "name": "Template Fitting Workflow",
    "description": "An agentic workflow to extract structured data from user text, utilizing skills, message templates, and tools (like GeoJSON generation).",
    "blueprint_data": {
        "nodes": [
            {
                "id": "start_node",
                "type": "start",
                "label": "Text Input",
                "description": "Receives the user paragraph and template context",
                "config": {},
                "position": {"x": 100, "y": 200}
            },
            {
                "id": "llm_extractor",
                "type": "llm",
                "label": "Extractor Agent",
                "description": "Extracts structured data using the Skill prompt and decides if tools are needed.",
                "config": {
                    "model": "gpt-4o",
                    "temperature": 0.1,
                    "system_prompt": "You are a data structuring assistant. Extract data from the provided text according to the target template schema. If a location is described, you should output what you extracted, and you may use the generate_geojson tool to fetch coordinates.",
                    "max_tokens": 1500
                },
                "position": {"x": 400, "y": 200}
            },
            {
                "id": "tool_executor",
                "type": "tool_executor",
                "label": "Tool Executor",
                "description": "Executes tools requested by the extractor (e.g., generate_geojson).",
                "config": {
                    "servers": ["local-tools"],
                    "allowed_tools": ["generate_geojson"]
                },
                "position": {"x": 700, "y": 100}
            },
            {
                "id": "evaluator_node",
                "type": "evaluator",
                "label": "Validation",
                "description": "Validates the extracted JSON against the template required fields.",
                "config": {
                    "metrics": ["schema_compliance", "confidence_score"],
                    "langfuse_enabled": True
                },
                "position": {"x": 700, "y": 300}
            },
            {
                "id": "end_node",
                "type": "end",
                "label": "Final Output",
                "description": "Returns the validated structured JSON data.",
                "config": {},
                "position": {"x": 1000, "y": 200}
            }
        ],
        "edges": [
            {
                "id": "e_start_llm",
                "source": "start_node",
                "target": "llm_extractor",
                "label": ""
            },
            {
                "id": "e_llm_tool",
                "source": "llm_extractor",
                "target": "tool_executor",
                "label": "tools required",
                "condition": "needs_tool"
            },
            {
                "id": "e_tool_eval",
                "source": "tool_executor",
                "target": "evaluator_node",
                "label": ""
            },
            {
                "id": "e_llm_eval",
                "source": "llm_extractor",
                "target": "evaluator_node",
                "label": "no tools",
                "condition": "default"
            },
            {
                "id": "e_eval_end",
                "source": "evaluator_node",
                "target": "end_node",
                "label": ""
            }
        ],
        "entry_point": "start_node"
    }
}

try:
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"Error: {e}")
    print(f"Response text: {response.text if 'response' in locals() else 'No response'}")
