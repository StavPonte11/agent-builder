# Template Filling & Extraction Guide

This guide explains how the "Template Filling" feature works, both as an independent standalone system and how it is integrated into the larger backend REST API. 

## The Core Concept

Template filling is the process of using an LLM (a "Skill") to extract unstructured text into a highly structured JSON format (a "Template"). 

The primary engine that does this is the **`SkillExecutor`** located in `packages/skills_framework/executor.py`.

It works by combining 4 elements:
1. **The Skill Prompt**: The underlying system instructions (e.g., "Extract the following JSON based on the schema...").
2. **The Parameters**: LLM configuration (Model name, temperature).
3. **The Template Data**: The schema definition, glossary terms, and few-shot examples that define the shape of the desired JSON.
4. **The User Input**: The actual free-text that needs to be structured.

---

## 1. Standalone Usage (The Framework)

When we say "standalone," we mean you can import and use the `SkillExecutor` in any standard Python script completely independently from FastAPI, routing, or databases. This is highly useful for running evaluations or testing on datasets without standing up a web server.

### Example Standalone Invocation
```python
import asyncio
from packages.skills_framework.executor import SkillExecutor

async def run_standalone():
    executor = SkillExecutor()

    # 1. Define the skill's system instructions
    skill_prompt = "Extract data into JSON matching this schema: {template_schema}"
    
    # 2. Define the template schema we want
    template_data = {
        "fields": [
            {"name": "incident_type", "type": "string"},
            {"name": "involved_parties", "type": "list"}
        ]
    }
    
    # 3. Define the actual user free-text input
    user_input = "There was a car crash involving John and Jane."

    # 4. Execute directly (No HTTP requests, no database)
    result = await executor.execute(
        skill_prompt=skill_prompt,
        parameters={"model": "gpt-4o-mini", "temperature": 0.0},
        template_data=template_data,
        user_input=user_input
    )
    
    print(result["output"])
    # Output: {"incident_type": "car crash", "involved_parties": ["John", "Jane"]}

if __name__ == "__main__":
    asyncio.run(run_standalone())
```

---

## 2. Integrated Usage (The Backend API)

When "Integrated" into the backend, the FastAPI application acts as a middleman. It receives an HTTP request, looks up the Template and Skill from the Postgres database, and then hands that data over to the **same** `SkillExecutor` we used in the standalone example.

Here is the flow of `routers/structuring.py`:
1. **HTTP Request Arrives**: The user sends `{"group_id": "123", "free_text": "car crash with John..."}` to the `/api/structure` endpoint.
2. **Database Lookup**: The router queries the database for Template associated with `group_id="123"` and the active "structuring" Skill.
3. **Delegation**: The router initializes the `SkillExecutor()`.
4. **Execution**: The router passes the database objects (converted to dictionaries) to the `executor.execute(...)` function.
5. **Response**: The JSON result is evaluated for confidence (missing fields) and sent back over HTTP.

**Why is this separation good?** Because if you want to test how good the LLM is at extracting a 10-page document, you don't need to spoof API calls or mock databases. You just use the standalone `SkillExecutor` on a dataset.

---

## 3. Advanced Use Cases

To implement advanced extraction scenarios, you extend the system surrounding the `SkillExecutor` or upgrade the LLM execution pipeline (potentially using LangGraph for multi-step reasoning).

### A. Long Paragraphs & Dense Extraction
- **The Problem**: A 10-page incident report needs 50 distinct fields extracted. LLMs lose context or hallucinate if the schema is too massive.
- **The Solution**: 
  - Break the massive template into smaller sub-templates (e.g., `PersonnelTemplate`, `TimelineTemplate`, `DamageTemplate`).
  - Run the `SkillExecutor` multiple times in parallel for each sub-template against the same long text. 

### B. Human-in-the-Loop Clarification
- **The Problem**: The user says "He was injured" but doesn't specify who "He" is. The template requires a `name`.
- **The Solution**: 
  - Have the `SkillExecutor` return a list of `missing_fields`.
  - Pause the workflow and send an actionable message back to the user: *"Who was injured in the incident?"*
  - Wait for the user's reply, append it to the original context, and re-run the `SkillExecutor`.

### C. Tool-Assisted Extraction
- **The Problem**: The user says "The server crashed at 2PM" but the template requires the exact server IP address.
- **The Solution**:
  - Equip the extraction agent (via LangChain tools) with a `lookup_server_ip` tool.
  - Before outputting final JSON, the agent detects the missing IP, pauses to execute the tool (`lookup_server_ip("app-server-1")`), reads the result, and fills the template fully.
