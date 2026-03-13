import json
import random
from locust import HttpUser, task, between

class AgentBuilderLoadTest(HttpUser):
    """
    Load testing suite for the Agent Builder API.
    Simulates common user behavior: viewing blueprints, executing workflows, and checking status.
    Requires locust to be installed (`uv pip install locust`)
    Run with: `locust -f locustfile.py --host=http://localhost:8000`
    """
    
    # Wait time between tasks (1 to 5 seconds)
    wait_time = between(1, 5)

    def on_start(self):
        """
        Executed when a simulated user starts.
        Sets up auth headers if necessary.
        """
        # In this demo setup, auth might be mocked or using a test token.
        self.headers = {"Authorization": "Bearer test-dev-token", "Content-Type": "application/json"}
        self.blueprint_ids = []
        
        # Pre-fetch available blueprints to use in tasks
        with self.client.get("/api/v1/blueprints", headers=self.headers, catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                self.blueprint_ids = [bp["id"] for bp in data if "id" in bp]

    @task(3)
    def view_blueprints(self):
        """Simulate users browsing the blueprint list."""
        self.client.get("/api/v1/blueprints", headers=self.headers)

    @task(2)
    def view_specific_blueprint(self):
        """Simulate a user opening a specific blueprint."""
        if not self.blueprint_ids:
            return
        
        bp_id = random.choice(self.blueprint_ids)
        self.client.get(f"/api/v1/blueprints/{bp_id}", headers=self.headers)

    @task(1)
    def trigger_execution(self):
        """Simulate a user hard-triggering an execution."""
        if not self.blueprint_ids:
            return
            
        bp_id = random.choice(self.blueprint_ids)
        payload = {
            "inputs": {
                "user_prompt": "Test query from load generator",
                "webhook_data": {"source": "locust"}
            }
        }
        
        with self.client.post(
            f"/api/v1/blueprints/{bp_id}/execute", 
            json=payload, 
            headers=self.headers,
            catch_response=True
        ) as response:
            if response.status_code in [200, 201]:
                data = response.json()
                exec_id = data.get("execution_id")
                # Immediately check status once
                if exec_id:
                    self.client.get(f"/api/v1/executions/{exec_id}", headers=self.headers)
            elif response.status_code == 404:
                # Ignore 404s if blueprints aren't fully seeded during specific test runs
                response.success()
