import requests
import json

url = "http://localhost:8000/api/blueprints"
data = {
    "name": "Demo Blueprint",
    "description": "A demo agent blueprint",
    "blueprint_data": {
        "nodes": [
            {
                "id": "node_1",
                "type": "llm",
                "config": {
                    "model": "gpt-4o",
                    "system_prompt": "You are a helpful assistant."
                }
            }
        ],
        "edges": [],
        "entry_point": "node_1"
    }
}

try:
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"Error: {e}")
    print(f"Response text: {response.text if 'response' in locals() else 'No response'}")
