# System Test Workflow

LangGraph agentic workflow that tests the entire Agent Builder platform — backend and frontend — and evaluates quality using an LLM judge.

Built in the same pattern as `prompts/orchestrator.py`.

---

## Architecture

```
plan_test_run
    │
    ▼
health_check
    │
    ├─[backend down]──────────────────────────────────────────────────► generate_report
    │
    ▼
test_backend_apis          (all E10 endpoints: health, blueprints, tools, audit-log, …)
    │
    ├─[all fail]─────────────────────────────────────────────────────► evaluate_results
    │
    ▼
test_blueprint_lifecycle   (create → validate → execute → checkpoints → CSV report)
    │
    ▼
test_execution_streaming   (WebSocket events coverage, fallback to HTTP polling)
    │
    ▼
test_ui_pages              (Playwright smoke: login, dashboard, all Phase 3 pages)
    │
    ▼
evaluate_results           (LLM-as-judge: 5 dimensions × weighted score)
    │
    ▼
generate_report            (Markdown report + Langfuse trace)
```

Every node:
- Is wrapped in a **Langfuse span**
- Scores a **Langfuse trace dimension**
- Writes structured `TestResult` dicts to state
- Handles exceptions gracefully (never crashes the graph)

State is preserved in **PostgreSQL** for `--resume` on failure.

---

## Running

### Prerequisite — install extra packages
```bash
pip install websockets playwright
playwright install chromium
```

### Quick run (no pytest)
```bash
python run_tests.py
```

### With custom URLs
```bash
python run_tests.py \
  --backend http://localhost:8000 \
  --frontend http://localhost:5173 \
  --email admin@yourorg.com \
  --password secret
```

### With PostgreSQL checkpointing (enables `--resume` on crash)
```bash
python run_tests.py --db-url postgresql+asyncpg://user:pass@localhost/agentbuilder
```

### Resume a crashed run
```bash
python run_tests.py --resume --thread-id <uuid> --db-url postgresql+asyncpg://...
```

### Via pytest (CI-friendly, full JUnit XML output)
```bash
pytest tests/test_system_e2e.py -v -m system --timeout=300
pytest tests/test_system_e2e.py -v -m api     # only API tests
pytest tests/test_system_e2e.py -v -m ui      # only Playwright tests
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0`  | All tests pass (score ≥ 0.90) |
| `1`  | Partial pass (score 0.50–0.90) |
| `2`  | Critical failure (score < 0.50) |

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `BACKEND_BASE_URL` | `http://localhost:8000` | Backend API URL |
| `FRONTEND_BASE_URL` | `http://localhost:5173` | Frontend URL |
| `TEST_USER_EMAIL` | `test@example.com` | Login credentials |
| `TEST_USER_PASSWORD` | `password123` | Login credentials |
| `DATABASE_URL` | *(optional)* | PostgreSQL for checkpointing |
| `OPENAI_API_KEY` | required | LLM judge evaluation |
| `LANGFUSE_PUBLIC_KEY` | *(optional)* | Observability |
| `LANGFUSE_SECRET_KEY` | *(optional)* | Observability |
| `LANGFUSE_HOST` | `http://localhost:3100` | Langfuse server |

---

## Output

### `test_report.md`
Markdown report with:
- Test summary table
- Per-phase results (API / Lifecycle / Streaming / UI / Eval)
- LLM judge 5-dimension assessment
- Actionable recommendations

### Langfuse traces
One trace per workflow run. Each node creates a span with inputs/outputs.
Scores emitted: `system_health`, `api_test_coverage`, `lifecycle_test_coverage`,
`websocket_event_coverage`, `ui_page_availability`, `eval_api_correctness`,
`eval_lifecycle_reliability`, `eval_streaming_coverage`, `eval_ui_availability`,
`eval_overall_quality`.

---

## Test Phases

| Phase | Node | What it tests |
|-------|------|---------------|
| Auth | `plan_test_run` | JWT login |
| Health | `health_check` | Backend + frontend reachability + latency |
| API | `test_backend_apis` | All E10 endpoints: health, blueprints CRUD, validate, estimate-cost, tools, base-prompts, audit-log, dependency-graph |
| Lifecycle | `test_blueprint_lifecycle` | NL generation → validate → create execution → poll terminal → checkpoints → CSV report |
| Streaming | `test_execution_streaming` | WebSocket connection, all 15 event types, HTTP fallback |
| UI | `test_ui_pages` | Playwright: 10 pages, no crashes, no console errors |
| Evaluation | `evaluate_results` | LLM judge: 5-dimensional weighted score |
| Report | `generate_report` | Markdown report + Langfuse flush |
