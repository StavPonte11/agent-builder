from locust import HttpUser, task, between
import random
import uuid

class AgentBuilderUser(HttpUser):
    wait_time = between(1, 5) # Simulate user think time
    
    def on_start(self):
        # Create a blueprint on startup
        self.blueprint_id = self.create_blueprint()

    def create_blueprint(self):
        blueprint_data = {
            "name": f"LoadTest Agent {uuid.uuid4()}",
            "description": "Created by Locust",
            "blueprint_data": {
                "nodes": [
                    {
                        "id": "llm1",
                        "type": "llm",
                        "config": {"model": "gpt-4"}
                    }
                ],
                "edges": [],
                "entry_point": "llm1"
            },
            "organization_id": None
        }
        
        with self.client.post("/api/blueprints", json=blueprint_data, catch_response=True) as response:
            if response.status_code == 200:
                return response.json()["id"]
            else:
                response.failure(f"Failed to create blueprint: {response.text}")
                return None

    @task(3) # Higher weight
    def execute_agent(self):
        if not self.blueprint_id:
            return
            
        payload = {
            "blueprint_id": self.blueprint_id,
            "input_data": {
                "messages": [{"role": "user", "content": "Hello from load test"}]
            },
            "environment": "production"
        }
        
        with self.client.post("/api/execute", json=payload, catch_response=True) as response:
            if response.status_code == 200:
                execution_id = response.json()["execution_id"]
                # Optionally poll for status (simulating real client)
                self.check_status(execution_id)
            else:
                response.failure(f"Failed to trigger execution: {response.text}")

    def check_status(self, execution_id):
        # Poll once just to generate load on status endpoint
        self.client.get(f"/api/execute/{execution_id}/status")

    @task(1)
    def view_blueprint(self):
        if self.blueprint_id:
            self.client.get(f"/api/blueprints/{self.blueprint_id}")
