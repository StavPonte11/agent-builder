# Architectural Decisions Record

## 1. Monorepo Strategy
**Context:** We consist of a frontend React application, a backend Python FastAPI application, and several shared Python internal packages.
**Decision:** Use Turborepo at the project root with `npm` workspaces for frontend script choreography. Backend dependencies are explicitly managed using Hatchling. Python packages exist in `packages/` so they can be tested independently and published or shared across multiple backend microservices if we scale out execution workers heavily.

## 2. API Framework & ORM
**Context:** Need high performance, Python 3.12 async-first approach.
**Decision:** FastAPI + SQLAlchemy 2.0 (Async). Use Alembic for migrations. Pydantic v2 for data validation.

## 3. Workflow Engine & Orchestration
**Context:** We need a way to build complex, branching AI workflows (Blueprints). 
**Decision:** We are using **LangGraph** inside our custom `BlueprintCompiler` to convert drag-and-drop JSON graphs into executable StateGraphs.
**Decision:** Since AI workflows can run for hours and require guaranteed execution + human-in-the-loop pausing, we wrap the `LangGraph` invocations inside **Temporal.io** Workflows. Temporal provides the durable persistence, retries, and sleeping mechanics.

## 4. Real-time Updates
**Context:** Users need to see which node is executing live on the frontend canvas.
**Decision:** The backend posts execution updates to **Redis Pub/Sub**. FastAPI serves a WebSocket endpoint that subscribes to the Redis topic and pushes JSON to the frontend.

## 5. Security & Isolation
**Context:** Users will execute unverified AI prompts and potentially arbitrary Python code blocks.
**Decision:** Use **RestrictedPython** inside the `code` nodes. Setup **Presidio** to detect and anonymize PII before queries go to the LLM (via the `guardrails` package).

## 6. Observability
**Context:** We need to trace token usage, chain of thought, and LLM latency.
**Decision:** Use **Langfuse** (via `evaluator` package). The FastAPI app is also instrumented with Prometheus to track basic HTTP latency and rate-limiting rejections.

## 7. Frontend State
**Context:** The visual canvas requires complex state tracking outside standard React control flow.
**Decision:** Use **Zustand** along with `zundo` (or manual array-based state tracking) for Undo/Redo the Canvas state. Server state is managed by **TanStack Query**.
