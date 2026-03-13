# Developer Experience & Evaluation Guide

This document outlines the enhancements made to the Agent Builder platform to unify the development workflow and implement enterprise-grade evaluation.

---

## 🚀 Quick Start: Step-by-Step Testing Guide

Follow these steps in order to verify the new features and evaluation framework.

### Pre-requisites
1. Ensure Docker Desktop is running.
2. In your terminal, navigate to the backend scripts folder:
   ```cmd
   cd apps/agent-builder-backend/scripts
   ```
3. Activate your virtual environment: 
   ```cmd
   .venv_dev\Scripts\activate
   ```

### Step 1: Initialize the Database
Run the seeder to populate templates and ensure the DB schema is up to date:
```powershell
python manage.py seed
```

### Step 2: Launch the Backend Sandbox
Start both the FastAPI server and the Temporal worker in one terminal:
```powershell
python manage.py demo
```

### Step 3: Run the Real-Life Evaluation Script
Open a **new terminal**, navigate to the `tests` directory, and run the evaluation:
```powershell
cd apps/agent-builder-backend/tests
python evaluate_agent.py
```
*What this does:* It fetches real financial text from a 10-K filing, summarizes it, and then uses a separate "Judge" LLM to grade the summary on accuracy and completeness.

### Step 4: Run Automated E2E Canvas Tests
While the `demo` services from Step 2 are running, execute the Playwright test:
```powershell
pytest test_multi_step_research_agent.py
```

### Step 5: Verify Pulse Dashboard
Launch the UI (`npm run builder` in `apps/agent-builder-ui`) and navigate to `http://localhost:5173/pulse`. You should see real-time graphs showing the execution activity from the previous steps.

---

## 🛠️ Developer Experience (Scripts & Testing)

We have unified the development environment and administration tasks into a single entry point.

### 1. Unified Administration CLI (`manage.py`)
Located at: `apps/agent-builder-backend/scripts/manage.py`

This script uses `Typer` and `Rich` to provide a beautiful, interactive command-line experience.

- **`python manage.py demo`**: Starts the FastAPI server and the Temporal Worker simultaneously.
- **`python manage.py seed`**: Populates the database with templates like the **Customer Support Auto-Responder** and **Multi-Agent Debate**.

### 2. Streamlined NPM Scripts
- **`npm run builder`**: Launch the Agent Builder canvas locally.

### 3. Automated E2E Testing
Located at: `apps/agent-builder-backend/tests/test_multi_step_research_agent.py`

---

## 🧪 Real-Life Example & Evaluation

### 1. Real-World Tooling & Scrapers
Located at: `apps/agent-builder-backend/tests/evaluate_agent.py`

### 2. LLM-as-a-Judge Architecture
Implementing a "Two-Player" architecture where a Judge Agent grades the Researcher on accuracy and completeness.

### 3. UI-Driven Evaluation Builder
Integrated into `BlueprintTestsPage.tsx`, allowing users to build regression suites directly from the UI.

---

## 🛡️ Windows Development Isolation

> [!NOTE]
> **Path Resolution Fix**: I have updated `manage.py` and `evaluate_agent.py` to automatically detect the project root. You can now run these scripts directly from the `scripts/` or `tests/` folders without encounterimg `ModuleNotFoundError`.
