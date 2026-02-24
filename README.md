# F.R.I.D.A.Y. Agent Builder

This project is a centralized "Agent Builder" designed for configuring workflows, templates, and executing logic across various LLMs. It operates as a monorepo containing front-end, back-end, and shared internal packages.

## Monorepo Layout

```
agent-builder/
│
├── apps/
│   ├── agent-builder-ui/       # React/TypeScript Frontend
│   └── agent-builder-backend/  # FastAPI/Python Backend
│
├── packages/
│   └── skills_framework/       # Core Evaluation & Execution Engines
│
└── .agent/                     # Meta configurations/Skills
```

## Packages

### Apps
*   **`agent-builder-ui`**: The user interface to manage Message Templates, Skills, Blueprints, and run executions. Refer to `apps/agent-builder-ui/README.md` for local development setup (`npm dev/build/test`).
*   **`agent-builder-backend`**: The primary backend service built on FastAPI. Integrates with Temporal for asynchronous workflows and heavily depends on local packages for distinct logic. Uses `uv` for python virtual environment management.

### Internal Framework
*   **`skills_framework`**: Contains standalone execution systems (SkillExecutor) and evaluation scripts (LLM-as-a-judge for Direct Scoring and Pairwise). This abstraction allows us to create datasets, run experiments, and evaluate model performance without being coupled to the REST API wrapper.

## Running Locally

1. Start the backend by navigating to `apps/agent-builder-backend/`, activating the virtual environment with `uv`, and running `uvicorn main:app --reload`.
2. Start the Temporal server using Docker.
3. Start the UI by navigating to `apps/agent-builder-ui` and using `npm run dev`.

For more detailed information, consult the `README.md` present inside each component directory.
