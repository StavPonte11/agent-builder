import requests
import json

url = "http://localhost:8000/api/blueprints"
data = {
    "name": "Natural Language to Scenario Flow",
    "description": "A workflow that takes a natural language description and generates a structured scenario mapping to GeoJSON.",
    "blueprint_data": {
        "nodes": [
            {
                "id": "node_input",
                "type": "start",
                "config": {}
            },
            {
                "id": "node_llm_parser",
                "type": "tool_executor",
                "config": {
                    "servers": ["local-tools"],
                    "allowed_tools": ["generate_geojson"]
                }
            },
            {
                "id": "node_state_writer",
                "type": "state_writer",
                "config": {
                    "target": "exercise_state",
                    "operation": "merge",
                    "extract_from_last_message": True
                }
            },
            {
                "id": "node_map_output",
                "type": "map_output",
                "config": {
                    "include_units": True,
                    "include_events": True
                }
            }
        ],
        "edges": [
            {
                "source": "node_input",
                "target": "node_llm_parser"
            },
            {
                "source": "node_llm_parser",
                "target": "node_state_writer"
            },
            {
                "source": "node_state_writer",
                "target": "node_map_output"
            }
        ],
        "entry_point": "node_input"
    }
}

try:
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"Error: {e}")
    print(f"Response text: {response.text if 'response' in locals() else 'No response'}")
