import os
import json
import asyncio
from langfuse import Langfuse
from dotenv import load_dotenv

# Load backend environment variables
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../apps/agent-builder-backend/.env")))

# Initialize Langfuse
langfuse = Langfuse()

DATASET_NAME = "comprehensive_incident_reports"

dataset_items = [
    {
        "input": (
            "This is field report 402. At approximately 14:30 hours yesterday, "
            "we received a distress call from the civilian transport vessel 'Star Gazer'. "
            "They suffered a critical engine failure in sector 7G. "
            "Captain Reynolds and First Officer Vance are both fine, but the ship is adrift. "
            "We dispatched repair drone Delta and reached the origin point by 16:00. "
            "However, parts are needed: specifically, a Class 3 plasma manifold. "
            "We might need to escalate to command to authorize replacement parts."
        ),
        "expected_output": {
            "incident_type": "engine failure",
            "location": "sector 7G",
            "involved_parties": [
                {"name": "Reynolds", "role": "Captain", "status": "fine"},
                {"name": "Vance", "role": "First Officer", "status": "fine"}
            ],
            "timeline": [
                {"time": "14:30", "event": "distress call received"},
                {"time": "16:00", "event": "repair drone Delta reached origin point"}
            ],
            "required_resources": ["Class 3 plasma manifold", "repair drone Delta"],
            "needs_escalation": True,
            "missing_info": []
        },
        "metadata": {
            "complexity": "medium",
            "target_template": "comprehensive_incident_report"
        }
    },
    {
        "input": (
            "Urgent: System crash in the main accounting database. Happened around midnight. "
            "It looks like an OOM error, but I need the DB admin to confirm. "
            "Jane from the DevOps team restarted the instances at 01:15 AM, but data from the last hour is missing. "
            "We need the backup drives sent over to the main data center and we need to notify the external auditors."
        ),
        "expected_output": {
            "incident_type": "System crash / OOM error",
            "location": "main accounting database",
            "involved_parties": [
                {"name": "Jane", "role": "DevOps", "status": "active"}
            ],
            "timeline": [
                {"time": "midnight", "event": "System crash"},
                {"time": "01:15 AM", "event": "Instances restarted"}
            ],
            "required_resources": ["backup drives", "DB admin confirmation"],
            "needs_escalation": True,
            "missing_info": ["Confirmation of OOM error by DB admin"]
        },
        "metadata": {
            "complexity": "high",
            "target_template": "comprehensive_incident_report"
        }
    },
    {
        "input": (
            "Event log 991: Routine security patrol in Sector B. "
            "Found a door unlocked at 22:00. Secured it. Nothing else to report."
        ),
        "expected_output": {
            "incident_type": "security breach / unlocked door",
            "location": "Sector B",
            "involved_parties": [],
            "timeline": [
                {"time": "22:00", "event": "found door unlocked and secured it"}
            ],
            "required_resources": [],
            "needs_escalation": False,
            "missing_info": []
        },
        "metadata": {
            "complexity": "low",
            "target_template": "comprehensive_incident_report"
        }
    },
    {
        "input": (
            "Medical Emergency at Site Alpha. "
            "Worker fell from scaffolding at 09:12 AM. "
            "Paramedics (Team 4) arrived at 09:20 AM. "
            "Worker is conscious but complaining of leg pain. Name is John Doe. "
            "Site manager Sarah Connor paused all operations. "
            "OSHA needs to be notified immediately. We need a medevac chopper to get him to City Hospital. "
            "Weather is getting worse, so we need to hurry."
        ),
        "expected_output": {
            "incident_type": "Medical Emergency",
            "location": "Site Alpha",
            "involved_parties": [
                {"name": "John Doe", "role": "Worker", "status": "conscious, leg pain"},
                {"name": "Team 4", "role": "Paramedics", "status": "on scene"},
                {"name": "Sarah Connor", "role": "Site manager", "status": "active"}
            ],
            "timeline": [
                {"time": "09:12 AM", "event": "worker fell from scaffolding"},
                {"time": "09:20 AM", "event": "paramedics arrived"}
            ],
            "required_resources": ["medevac chopper"],
            "needs_escalation": True,
            "missing_info": ["Weather updates"]
        },
        "metadata": {
            "complexity": "high",
            "target_template": "comprehensive_incident_report"
        }
    }
]

def main():
    print(f"Creating or updating dataset: {DATASET_NAME}")
    dataset = langfuse.create_dataset(name=DATASET_NAME, description="Complex incident reports for dense extraction testing.")
    
    print(f"Adding {len(dataset_items)} items...")
    for i, item in enumerate(dataset_items):
        langfuse.create_dataset_item(
            dataset_name=DATASET_NAME,
            input={"text": item["input"]},
            expected_output=item["expected_output"],
            metadata=item["metadata"]
        )
        print(f"Added item {i+1}")
        
    print("Dataset populated successfully.")

if __name__ == "__main__":
    main()
