# FULL IMPLEMENTATION PROMPT
# Unified Agent & Workflow Builder Platform
# ==========================================
# Deliver as a production-ready monorepo.
# Read this entire prompt before writing a single line of code.
# Every section marked [REQUIRED] must be implemented. [OPTIONAL] sections 
# are stretch goals but architecturally accounted for.

---

## 0. PRIME DIRECTIVE

You are building a **centralized Agent & Workflow Builder Platform** — a 
professional-grade SaaS product that lets enterprise teams visually compose, 
test, publish, and monitor AI-powered workflows and autonomous agents at high 
scale (thousands of concurrent users, millions of workflow executions/month).

The system must be:
- **Correct**: All business logic must be sound and tested
- **Scalable**: Built for horizontal scaling from day one
- **Observable**: Every execution fully traced and monitored
- **Safe**: Multi-layer guardrails on every LLM interaction
- **Beautiful**: UI that engineers AND non-technical users want to use daily

---

## 1. MONOREPO STRUCTURE

```
agent-builder/
├── apps/
│   ├── agent-builder-ui/          # React + Vite + shadcn/ui + Tailwind
│   └── agent-builder-backend/     # FastAPI + Temporal + SQLAlchemy
├── packages/
│   ├── shared-types/              # TypeScript types shared between apps
│   ├── workflow-engine/           # Python: LangGraph workflow compiler
│   ├── guardrails/                # Python: safety + PII + injection detection
│   ├── evaluator/                 # Python: LLM-as-judge + Langfuse integration
│   └── mcp-registry/              # Python: MCP tool manifest + executor
├── infra/
│   ├── docker-compose.yml         # Full local stack
│   ├── docker-compose.prod.yml    # Production overrides
│   └── temporal/                  # Temporal worker configs
├── .env.example
├── turbo.json                     # Turborepo config
└── package.json                   # Workspace root
```

---

## 2. TECHNOLOGY STACK (NON-NEGOTIABLE)

### Frontend
- **Framework**: React 18 + Vite 5 + TypeScript strict
- **Styling**: Tailwind CSS v3 + shadcn/ui (full component library)
- **Canvas**: React Flow v11 (@xyflow/react) for workflow/agent graph editor
- **State**: Zustand (local UI state) + TanStack Query v5 (server state)
- **Forms**: React Hook Form + Zod validation
- **Real-time**: Socket.io-client (execution streaming)
- **i18n**: react-i18next with EN + HE locales (full RTL support for Hebrew)
- **Tables**: TanStack Table v8
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Fonts**: Choose a distinctive pairing (NOT Inter/Roboto/Arial). Suggestion: 
  "DM Mono" for code/technical elements + "Instrument Serif" for headings + 
  "Geist" for body. Or choose something even more distinctive. The UI must look 
  deliberately designed, not default-bootstrapped.

### Backend
- **Framework**: FastAPI 0.111+ (Python 3.12)
- **Package manager**: uv (NOT pip directly)
- **Async task orchestration**: **Temporal.io** (primary, for durable workflows)
- **Background jobs**: **Celery + Redis** (secondary, for lightweight async tasks 
  like notifications, cache invalidation, webhook delivery)
- **Database**: PostgreSQL 16 (via SQLAlchemy 2.0 async + Alembic migrations)
- **Cache / broker**: Redis 7 (Celery broker + application cache + rate limiting)
- **Search**: PostgreSQL full-text search (no Elasticsearch required at MVP)
- **Auth**: JWT (access + refresh tokens) + API keys for programmatic access
- **AI orchestration**: LangGraph (stateful multi-step agent execution)
- **LLM providers**: OpenAI, Anthropic, Google Gemini (via LangChain provider adapters)
- **Observability**: Langfuse (tracing, evaluation, datasets)
- **Safety**: OpenAI Moderation API + Microsoft Presidio (PII)
- **WebSockets**: FastAPI native WebSocket for real-time execution streaming

### Infrastructure (docker-compose)
- PostgreSQL 16
- Redis 7
- Temporal Server (temporalio/auto-setup image)
- Temporal Worker (custom Python image)
- Langfuse (self-hosted, langfuse/langfuse:2)
- Celery Worker
- Flower (Celery monitoring)
- The FastAPI app itself

---

## 3. DATABASE SCHEMA

### Core entities (implement as SQLAlchemy async models + Alembic migrations)

```python
# All models inherit from a Base with:
# id: UUID primary key
# created_at: datetime (UTC, auto)
# updated_at: datetime (UTC, auto-update)
# created_by: FK → User
# is_deleted: bool (soft delete)

class Organization:
    id, name, slug, plan_tier, max_users, max_executions_per_month
    settings: JSONB  # feature flags, defaults

class User:
    id, org_id FK, email, hashed_password, role (admin|builder|viewer)
    is_active, last_login, preferences: JSONB

class APIKey:
    id, user_id FK, key_hash, name, scopes: ARRAY[str]
    last_used_at, expires_at, is_active

class BasePrompt:
    # Org-level immutable system prompts. Only org admins can write.
    # Workflow builders can READ but cannot override.
    id, org_id FK, name, content, version: int
    is_active, metadata: JSONB

class MessageTemplate:
    # Reusable prompt templates with variable interpolation {{variable}}
    id, org_id FK, name, description, content, variables: JSONB
    category, tags: ARRAY[str], version: int, is_published

class Skill:
    # Reusable LangGraph sub-graph or Python callable
    id, org_id FK, name, description, skill_type (llm|tool|code|retrieval)
    config: JSONB, input_schema: JSONB, output_schema: JSONB
    version: int, is_published, test_results: JSONB

class Blueprint:
    # A workflow or agent definition (the canvas graph)
    id, org_id FK, name, description
    blueprint_type: enum (workflow|agent)
    definition: JSONB  # Full React Flow node/edge graph serialized
    compiled_graph: JSONB  # Compiled LangGraph definition
    base_prompt_id FK (nullable), config: JSONB
    status: enum (draft|testing|pending_approval|published|archived)
    version: int, published_version: int, parent_id FK (nullable, for versioning)
    tags: ARRAY[str], metadata: JSONB

class BlueprintVersion:
    # Immutable snapshot of each published version
    id, blueprint_id FK, version: int, definition: JSONB
    published_at, published_by FK, release_notes, is_rollback_target

class BlueprintTest:
    # Test cases for a blueprint (owner-created)
    id, blueprint_id FK, name, description
    test_type: enum (unit|integration|evaluation)
    input_data: JSONB, expected_output: JSONB
    evaluation_criteria: JSONB  # For LLM-as-judge
    langfuse_dataset_id: str (nullable)

class BlueprintTestRun:
    id, blueprint_id FK, test_id FK, triggered_by FK
    status: enum (pending|running|passed|failed|error)
    results: JSONB, score: float (nullable)
    langfuse_trace_id: str, duration_ms: int
    ran_at, node_results: JSONB  # Per-node pass/fail

class PublishRequest:
    id, blueprint_id FK, requested_by FK, reviewed_by FK (nullable)
    status: enum (pending|approved|rejected|withdrawn)
    version: int, release_notes, reviewer_notes
    requested_at, reviewed_at
    sanity_check_results: JSONB  # Automated safety checks
    test_run_results: JSONB

class Execution:
    # Every blueprint run (both sandbox and production)
    id, blueprint_id FK, blueprint_version: int, triggered_by FK
    execution_mode: enum (sandbox|production)
    status: enum (pending|running|paused|completed|failed|cancelled|timed_out)
    input_data: JSONB, output_data: JSONB
    temporal_workflow_id: str (nullable), temporal_run_id: str (nullable)
    langfuse_trace_id: str, langfuse_session_id: str
    started_at, completed_at, duration_ms: int
    token_usage: JSONB  # {prompt, completion, total, cost_usd}
    node_executions: JSONB  # Per-node execution trace
    error_details: JSONB, is_sandbox: bool

class ExecutionApproval:
    # Human-in-the-loop approvals during execution
    id, execution_id FK, node_id: str, requested_by FK (nullable)
    status: enum (pending|approved|rejected|timed_out)
    requested_at, resolved_at, resolver_id FK (nullable)
    context_data: JSONB, resolution_notes

class GuardrailLog:
    id, execution_id FK, node_id: str
    check_type: enum (input_moderation|output_moderation|pii_detection|injection_detection|token_limit|cost_limit|rate_limit)
    triggered: bool, action_taken: enum (allow|block|redact|warn)
    details: JSONB, checked_at

class MCPTool:
    id, org_id FK, name, description, tool_id: str (unique per org)
    manifest: JSONB, base_url: str, auth_config: JSONB (encrypted)
    is_active, version: str, capabilities: JSONB
    health_status: enum (healthy|degraded|offline)
    last_health_check: datetime

class Notification:
    id, user_id FK, type: str, title, body
    metadata: JSONB, is_read, read_at, created_at
```

---

## 4. BACKEND ARCHITECTURE

### 4.1 FastAPI Application Structure

```
agent-builder-backend/
├── app/
│   ├── main.py              # FastAPI app factory, lifespan, middleware
│   ├── config.py            # Pydantic Settings (env vars)
│   ├── database.py          # SQLAlchemy async engine + session factory
│   ├── redis_client.py      # Redis async client singleton
│   ├── dependencies.py      # Shared FastAPI dependencies (auth, db, rate limit)
│   │
│   ├── api/
│   │   ├── v1/
│   │   │   ├── router.py          # Main v1 router aggregator
│   │   │   ├── auth.py            # POST /auth/login, /auth/refresh, /auth/logout
│   │   │   ├── users.py           # CRUD /users
│   │   │   ├── organizations.py   # CRUD /organizations
│   │   │   ├── templates.py       # CRUD /templates (MessageTemplate)
│   │   │   ├── skills.py          # CRUD /skills
│   │   │   ├── blueprints.py      # CRUD /blueprints + publish flow
│   │   │   ├── executions.py      # POST /execute + GET /executions
│   │   │   ├── approvals.py       # GET/POST /approvals
│   │   │   ├── tests.py           # CRUD /blueprints/{id}/tests + run
│   │   │   ├── tools.py           # CRUD /tools (MCP)
│   │   │   ├── base_prompts.py    # CRUD /base-prompts (admin only)
│   │   │   └── notifications.py   # GET /notifications + mark read
│   │   └── ws/
│   │       └── execution.py       # WS /ws/executions/{execution_id}
│   │
│   ├── models/              # SQLAlchemy models (one file per entity)
│   ├── schemas/             # Pydantic request/response schemas
│   ├── services/            # Business logic (one file per domain)
│   │   ├── auth_service.py
│   │   ├── blueprint_service.py
│   │   ├── execution_service.py
│   │   ├── publish_service.py
│   │   ├── test_service.py
│   │   └── notification_service.py
│   │
│   ├── temporal/
│   │   ├── client.py        # Temporal client singleton
│   │   ├── workflows/
│   │   │   ├── execute_blueprint.py     # Main durable workflow
│   │   │   ├── run_tests.py             # Test execution workflow
│   │   │   └── publish_pipeline.py     # Sanity checks + approval workflow
│   │   └── activities/
│   │       ├── llm_activities.py        # LLM node execution
│   │       ├── tool_activities.py       # MCP tool calls
│   │       ├── guardrail_activities.py  # Safety checks
│   │       ├── evaluation_activities.py # Langfuse scoring
│   │       └── notification_activities.py
│   │
│   ├── celery_app.py        # Celery app factory
│   ├── tasks/
│   │   ├── webhooks.py      # Webhook delivery (retry logic)
│   │   ├── cache.py         # Cache warming/invalidation
│   │   └── reports.py       # Scheduled usage reports
│   │
│   └── middleware/
│       ├── auth.py          # JWT validation middleware
│       ├── rate_limit.py    # Redis sliding window rate limiter
│       ├── request_id.py    # X-Request-ID injection
│       └── metrics.py       # Prometheus metrics exposition
```

### 4.2 Temporal Workflow Design

**ExecuteBlueprintWorkflow** (the core durable execution workflow):
```
Input:  ExecutionRequest{blueprint_id, version, input_data, execution_mode, user_id}
Output: ExecutionResult{status, output_data, token_usage, trace_id}

Steps:
1. Activity: validate_blueprint_schema(definition)
2. Activity: run_guardrails_on_input(input_data, blueprint_config)
   → If BLOCKED: terminate with reason
3. For each node in topological order:
   a. Activity: pre_node_guardrails(node, input)
   b. If node.requires_approval:
      → Signal: request_human_approval(node, context)
      → Wait for ApprovalSignal (with timeout)
      → If rejected or timed_out: terminate
   c. Activity: execute_node(node_type, node_config, input)
      → LLMNode: call LLM with full prompt chain + base_prompt
      → ToolNode: call MCP executor
      → ConditionNode: evaluate expression
      → RouterNode: LLM-based routing
      → MemoryNode: read/write Redis or Postgres
   d. Activity: post_node_guardrails(node, output)
   e. Activity: stream_node_result(execution_id, node_id, result)
      → Pushes to Redis pub/sub → WebSocket clients
4. Activity: run_guardrails_on_output(final_output, blueprint_config)
5. Activity: finalize_execution(results, token_usage, langfuse_trace)
```

**PublishPipelineWorkflow**:
```
Steps:
1. Activity: run_automated_sanity_checks(blueprint)
   → Schema validation
   → Guardrail config completeness
   → Required base_prompt presence
   → No hardcoded secrets
   → LLM model availability check
2. Activity: run_owner_tests(blueprint_id)
   → Must pass ALL owner-created tests
3. Signal: notify_admins_for_review(publish_request_id)
4. Wait for AdminApprovalSignal (no timeout — admin must act)
5. If approved:
   a. Activity: create_blueprint_version_snapshot(blueprint)
   b. Activity: update_blueprint_status(published)
   c. Activity: notify_stakeholders(approved)
6. If rejected:
   a. Activity: update_publish_request(rejected, notes)
   b. Activity: notify_owner(rejected, notes)
```

### 4.3 Rate Limiting Strategy

Implement a Redis-backed sliding window rate limiter as FastAPI middleware:

```python
# Limits (configurable per org plan tier):
RATE_LIMITS = {
    "free":       {"executions": 100/hour,  "api_calls": 1000/hour},
    "pro":        {"executions": 1000/hour, "api_calls": 10000/hour},
    "enterprise": {"executions": 10000/hour,"api_calls": 100000/hour},
}

# Keys: f"rl:{org_id}:{resource}:{window_start}"
# Return 429 with Retry-After header when limit exceeded
# Track per-user AND per-org limits separately
```

### 4.4 WebSocket Real-time Streaming

During workflow execution, stream node-by-node results to connected clients:

```python
# FastAPI WebSocket endpoint: /ws/executions/{execution_id}
# Protocol: JSON messages with type field

# Message types:
# { type: "node_started",   node_id, node_type, timestamp }
# { type: "node_output",    node_id, chunk: str }        ← streaming LLM tokens
# { type: "node_completed", node_id, output, duration_ms, token_usage }
# { type: "node_error",     node_id, error, is_fatal }
# { type: "guardrail_triggered", node_id, check_type, action }
# { type: "approval_required",   node_id, context }
# { type: "execution_completed", output, total_duration_ms, total_tokens }
# { type: "execution_failed",    error, node_id (nullable) }

# Implementation:
# 1. Temporal activity publishes to Redis Pub/Sub channel: f"exec:{execution_id}"
# 2. WebSocket handler subscribes to that channel
# 3. Forwards messages to connected WebSocket client
# 4. On disconnect: gracefully unsubscribe
# 5. On reconnect: replay last 50 messages from Redis stream
```

### 4.5 LangGraph Integration

The `workflow-engine` package compiles Blueprint definitions into LangGraph StateGraphs:

```python
# packages/workflow-engine/compiler.py

class BlueprintCompiler:
    """
    Converts a Blueprint.definition (React Flow graph JSON) into a 
    LangGraph StateGraph that can be executed by Temporal activities.
    """
    
    def compile(self, definition: dict) -> CompiledGraph:
        # 1. Parse nodes and edges from React Flow format
        # 2. Build topological sort
        # 3. Create LangGraph StateGraph
        # 4. For each node type, create appropriate LangGraph node:
        #    - LLMNode → async function calling LLM with streaming
        #    - ToolNode → async MCP tool executor
        #    - ConditionNode → conditional edge function
        #    - RouterNode → LLM-based router (picks next node)
        #    - MemoryReadNode → reads from Redis/Postgres
        #    - MemoryWriteNode → writes to Redis/Postgres
        #    - ApprovalNode → raises ApprovalRequired signal
        #    - CodeNode → executes sandboxed Python (RestrictedPython)
        # 5. Add guardrail hooks as node pre/post processors
        # 6. Return serializable CompiledGraph for storage + Temporal execution
```

### 4.6 Guardrails Package

```python
# packages/guardrails/

class GuardrailPipeline:
    """
    Runs a sequence of safety checks. Short-circuits on first BLOCK.
    All checks run in parallel where possible (asyncio.gather).
    """
    
    async def check_input(self, text: str, config: GuardrailConfig) -> GuardrailResult:
        checks = [
            self.moderation_check(text),      # OpenAI Moderation API
            self.pii_detection(text),         # Presidio
            self.injection_detection(text),   # Prompt injection patterns + LLM classifier
            self.token_limit_check(text, config.max_input_tokens),
        ]
        results = await asyncio.gather(*checks, return_exceptions=True)
        return GuardrailResult(checks=results, overall_action=self._determine_action(results))
    
    async def check_output(self, text: str, config: GuardrailConfig) -> GuardrailResult:
        # Same pipeline minus injection detection
        # Add: cost limit check based on tokens used so far
    
    # PII modes: DETECT_ONLY | REDACT | BLOCK
    # Redaction replaces with: <REDACTED:ENTITY_TYPE>
    
    # Injection detection:
    # 1. Pattern matching (known jailbreak patterns)
    # 2. Heuristic: "ignore previous instructions", "you are now", etc.
    # 3. LLM classifier for subtle attacks (configurable)
```

### 4.7 Evaluator Package

```python
# packages/evaluator/

class BlueprintEvaluator:
    """
    Runs LLM-as-judge evaluation after test execution.
    Scores are pushed to Langfuse datasets.
    """
    
    async def evaluate_test_run(
        self, 
        test: BlueprintTest, 
        actual_output: dict,
        langfuse_trace_id: str
    ) -> EvaluationResult:
        # 1. If test.evaluation_criteria is set, use LLM-as-judge
        # 2. Judge model: gpt-4o (configurable)
        # 3. Scoring dimensions from criteria:
        #    - correctness (0-1): Did output match expected?
        #    - completeness (0-1): Did output cover all required aspects?
        #    - safety (0-1): No harmful content in output?
        #    - format_adherence (0-1): Matches expected output schema?
        # 4. Post scores to Langfuse via langfuse.score()
        # 5. Return EvaluationResult with per-dimension scores + reasoning
```

---

## 5. FRONTEND ARCHITECTURE

### 5.1 Application Structure

```
agent-builder-ui/src/
├── app/
│   ├── layout.tsx               # Root layout with providers
│   ├── (auth)/                  # Login, register (unauthenticated)
│   ├── (platform)/              # Authenticated shell
│   │   ├── layout.tsx           # Sidebar + header shell
│   │   ├── dashboard/           # Home dashboard
│   │   ├── blueprints/          # Blueprint list + builder
│   │   │   ├── page.tsx         # List view
│   │   │   ├── new/page.tsx     # Create new
│   │   │   └── [id]/
│   │   │       ├── page.tsx     # Builder canvas
│   │   │       ├── tests/       # Test management
│   │   │       ├── publish/     # Publish flow
│   │   │       └── history/     # Version history
│   │   ├── templates/           # Message templates
│   │   ├── skills/              # Skills library
│   │   ├── tools/               # MCP tool catalog
│   │   ├── executions/          # Execution history
│   │   ├── approvals/           # Pending approvals (admin)
│   │   ├── analytics/           # Usage + cost dashboard
│   │   └── settings/            # Org + user settings
├── components/
│   ├── ui/                      # shadcn/ui base components (DO NOT MODIFY)
│   ├── builder/                 # Workflow builder canvas components
│   │   ├── Canvas.tsx           # React Flow canvas wrapper
│   │   ├── NodePalette.tsx      # Left sidebar node draggable palette
│   │   ├── nodes/               # Custom React Flow node components
│   │   │   ├── LLMNode.tsx
│   │   │   ├── ToolNode.tsx
│   │   │   ├── ConditionNode.tsx
│   │   │   ├── RouterNode.tsx
│   │   │   ├── MemoryNode.tsx
│   │   │   ├── ApprovalNode.tsx
│   │   │   ├── TriggerNode.tsx
│   │   │   └── OutputNode.tsx
│   │   ├── edges/               # Custom edge types
│   │   │   ├── ConditionEdge.tsx
│   │   │   └── DefaultEdge.tsx
│   │   ├── panels/
│   │   │   ├── NodeConfigPanel.tsx    # Right sidebar node properties
│   │   │   ├── BlueprintMetaPanel.tsx # Blueprint name/desc/settings
│   │   │   ├── GuardrailsPanel.tsx    # Blueprint-level safety config
│   │   │   ├── TestPanel.tsx          # Test runner panel
│   │   │   └── NLGeneratorPanel.tsx   # Natural language → graph
│   │   └── toolbar/
│   │       ├── BuilderToolbar.tsx     # Top toolbar
│   │       └── CanvasControls.tsx     # Zoom, fit, undo/redo
│   ├── execution/
│   │   ├── ExecutionMonitor.tsx  # Real-time execution viewer
│   │   ├── NodeStatusBadge.tsx   # Per-node status indicator
│   │   ├── TokenUsageBar.tsx     # Live token + cost counter
│   │   └── ApprovalModal.tsx     # Human approval dialog
│   ├── sandbox/
│   │   ├── SandboxChat.tsx       # Interactive test chat
│   │   └── SandboxSidebar.tsx    # Execution details panel
│   ├── publish/
│   │   ├── PublishWizard.tsx     # Multi-step publish flow
│   │   ├── SanityCheckResults.tsx
│   │   ├── TestRunSummary.tsx
│   │   └── AdminReviewPanel.tsx
│   ├── analytics/
│   │   ├── UsageDashboard.tsx
│   │   ├── CostBreakdown.tsx
│   │   └── ExecutionTimeline.tsx
│   └── shared/
│       ├── DataTable.tsx         # TanStack Table wrapper
│       ├── JsonEditor.tsx        # Monaco-based JSON editor
│       ├── VariableInput.tsx     # {{variable}} template input
│       └── StatusDot.tsx
├── hooks/
│   ├── useBlueprint.ts          # Blueprint CRUD + canvas state
│   ├── useExecution.ts          # Execution + WebSocket streaming
│   ├── useApproval.ts           # Approval polling + resolution
│   ├── useCanvasHistory.ts      # Undo/redo for canvas
│   └── useRealtime.ts           # WebSocket connection manager
├── stores/
│   ├── canvasStore.ts           # Zustand: React Flow nodes/edges state
│   ├── executionStore.ts        # Zustand: live execution state
│   ├── uiStore.ts               # Zustand: panels, sidebar state
│   └── authStore.ts             # Zustand: user session
├── lib/
│   ├── api.ts                   # TanStack Query + Axios client
│   ├── websocket.ts             # WebSocket connection factory
│   ├── blueprint-serializer.ts  # React Flow ↔ API definition conversion
│   └── cost-estimator.ts        # Client-side token/cost estimation
└── i18n/
    ├── config.ts
    └── locales/
        ├── en.json              # Full English strings
        └── he.json              # Full Hebrew strings (RTL)
```

### 5.2 Design System Requirements

**AESTHETIC DIRECTION**: Industrial precision meets dark intelligence. Think a 
professional operations center: dark backgrounds, surgical typography, data-dense 
layouts that feel powerful not cluttered. Inspired by Linear, Vercel, and Datadog 
but with its own distinct character.

**Color Palette** (implement as CSS variables + Tailwind config extension):
```css
--background:     #080C14    /* Deep navy-black */
--surface:        #0F1624    /* Slightly lighter surface */
--card:           #162032    /* Card backgrounds */
--border:         #1E2D42    /* Subtle borders */
--border-strong:  #2A3F5A    /* Interactive borders */

--accent-primary: #2563EB    /* Electric blue — primary actions */
--accent-success: #059669    /* Emerald — success/active states */
--accent-warning: #D97706    /* Amber — warnings */
--accent-danger:  #DC2626    /* Red — errors/destructive */
--accent-purple:  #7C3AED    /* Violet — LLM nodes */
--accent-cyan:    #0891B2    /* Cyan — tool nodes */
--accent-orange:  #EA580C    /* Orange — condition/router nodes */

--text-primary:   #E2E8F0    /* Primary text */
--text-secondary: #94A3B8    /* Secondary/muted text */
--text-dim:       #475569    /* Very muted text */

/* Node colors by type */
--node-llm:       #7C3AED    /* Purple — LLM nodes */
--node-tool:      #0891B2    /* Cyan — Tool/MCP nodes */
--node-condition: #EA580C    /* Orange — Condition/Router */
--node-memory:    #059669    /* Green — Memory nodes */
--node-approval:  #DC2626    /* Red — Approval gates */
--node-trigger:   #2563EB    /* Blue — Trigger/input */
--node-output:    #D97706    /* Amber — Output nodes */
```

**Typography**:
- Display headings: "DM Serif Display" or "Playfair Display" — for page titles only
- UI headings: "Bricolage Grotesque" — section headings, panel titles
- Body: "Geist" or "Plus Jakarta Sans" — all body text
- Code/technical: "DM Mono" or "JetBrains Mono" — JSON, prompts, code
- Load from Google Fonts or Fontsource

**shadcn/ui Component Customizations**:
- Override `components.json` theme to match color palette above
- All shadcn components should use the dark theme by default
- Custom `cn()` utility combining clsx + tailwind-merge
- Extend with:
  - `<GlowCard>` — card with subtle gradient border glow on hover
  - `<StatusBadge>` — colored pill with dot indicator
  - `<MetricCard>` — stat display card with icon + value + trend
  - `<CodeBlock>` — syntax-highlighted code display (use shiki or prism)
  - `<NodeBadge>` — colored node type identifier badge
  - `<ProgressRing>` — circular progress indicator (for test run progress)
  - `<EmptyState>` — illustrated empty state with CTA

**Motion/Animation Requirements** (Framer Motion):
- Page transitions: fade + slide (150ms)
- Panel open/close: spring animation
- Node add/remove: scale + fade
- Execution progress: smooth progress bars with glow
- Notification toast: slide in from top-right
- Canvas node selection: highlight ring pulse
- Loading states: skeleton screens (not spinners)

### 5.3 Builder Canvas — Node Specifications

Each node type must be implemented as a custom React Flow node with:
- Type-specific color/icon header
- Collapsed/expanded states
- Inline status indicator during execution (idle/running/completed/error)
- Selection behavior: clicking opens NodeConfigPanel in right sidebar
- Drag handles on edges to create connections
- Validation state: red border if misconfigured

**Node Types to Implement**:

```typescript
// 1. TRIGGER NODE
// Inputs: webhook | schedule | manual | event (from infra API, etc.)
// Config: trigger_type, filter_expression, input_schema
// Visual: Lightning bolt icon, blue accent

// 2. LLM NODE  
// Config: provider (openai|anthropic|google), model, temperature, max_tokens,
//         system_prompt (references BasePrompt or custom), user_prompt_template,
//         streaming: bool, response_format (text|json|structured)
// Shows: estimated cost, model badge, base_prompt indicator if set
// Visual: Brain/sparkle icon, purple accent

// 3. TOOL NODE (MCP)
// Config: tool_id (from MCP registry), capability, input_mapping
// Shows: tool name, method badge (GET/POST), capability description
// Visual: Plug icon, cyan accent

// 4. CONDITION NODE
// Config: expression (JS-style: {{output.score}} >= 0.8),
//         true_path_label, false_path_label
// Has TWO output handles: "true" (green) and "false" (red)
// Visual: Diamond shape, orange accent

// 5. ROUTER NODE (LLM-based)
// Config: routing_prompt, routes: [{label, condition_description}]
// LLM reads input and picks a route based on condition_description
// Visual: Split/branch icon, orange accent

// 6. MEMORY READ NODE
// Config: backend (redis|postgres), key_expression, default_value
// Visual: Database/download icon, green accent

// 7. MEMORY WRITE NODE
// Config: backend (redis|postgres), key_expression, value_expression, ttl
// Visual: Database/upload icon, green accent

// 8. APPROVAL NODE
// Config: approver_role (admin|owner|any), timeout_minutes, timeout_action (reject|approve|pause)
//         context_template: what to show the approver
// Shows: red warning badge, "Requires human approval" label
// Visual: Shield icon, red accent

// 9. CODE NODE (sandboxed Python)
// Config: code (Python string, restricted to safe builtins), 
//         input_vars: list of {{variables}} from previous nodes,
//         output_schema
// Visual: Terminal/code icon, slate accent

// 10. OUTPUT NODE
// Config: output_schema, response_format, final_message_template
// Terminal node — no outgoing edges
// Visual: Flag icon, amber accent
```

### 5.4 Builder Canvas — Toolbar Requirements

```typescript
// Top toolbar items (left to right):
// [← Back] [Blueprint Name (editable inline)] [Status Badge] [Version]
// ... spacer ...
// [Undo] [Redo] [|] [Auto Layout] [Fit View] [|] [Validate] [Estimate Cost]
// [|] [Run in Sandbox ▶] [Test Suite ⚗] [Publish 🚀]

// Left panel (NodePalette) — Sections:
// ─ TRIGGERS ─
//   Webhook Trigger | Schedule Trigger | Manual Trigger
// ─ AI / LLM ─  
//   LLM Node | Router Node
// ─ TOOLS ─
//   Tool Node (MCP) | Code Node
// ─ FLOW CONTROL ─
//   Condition Node | Approval Gate
// ─ MEMORY ─
//   Memory Read | Memory Write
// ─ TERMINAL ─
//   Output Node
// ─ SKILLS ─
//   [Dynamically listed from org Skills library]
//   Each draggable, expands to its sub-graph when dropped

// Right panel (NodeConfigPanel) — appears on node selection:
// Shows all config fields for the selected node type
// Each field has:
//   - Label + description tooltip
//   - Appropriate input type (text, select, textarea, toggle, JSON editor)
//   - {{variable}} autocomplete for referencing previous node outputs
//   - Validation feedback inline
//   - "Test this node in isolation" button (unit test)
```

### 5.5 Execution Monitor UI

When a blueprint is executing (sandbox or production), the canvas transforms:

```typescript
// Execution mode canvas overlay:
// - Nodes show real-time status: idle (dimmed) | running (pulsing ring) | 
//   completed (green checkmark) | error (red X) | blocked (guardrail icon)
// - Active edges animate (flow direction visible)
// - Node output previews appear inline as execution progresses
// - Streaming LLM tokens appear in a floating overlay on the active LLM node
// - Top banner: execution progress bar + live token counter + estimated cost

// Right panel during execution:
// - "Execution Log" tab: chronological per-node timeline
// - "Node Output" tab: full output of selected node (JSON formatted)
// - "Guardrails" tab: all guardrail check results
// - "Trace" tab: link to Langfuse trace

// Approval modal (when ApprovalNode is hit):
// - Modal BLOCKS the UI with overlay
// - Shows: node name, context from context_template, input data
// - Approve / Reject buttons
// - Countdown timer if timeout configured
```

### 5.6 Sandbox / Chat Interface

A separate mode for interactively testing agents:

```typescript
// Layout: Chat interface (left 60%) + Execution details sidebar (right 40%)
//
// Chat panel:
// - Message thread (user + agent messages)
// - Streaming agent responses (token-by-token)
// - Each agent message shows: response + node that produced it + token count
// - Input: text + file attachment support
// - Cost tracking bar: "This session: $0.042 | 1,247 tokens"
//
// Sidebar (execution details):
// - "Graph View" tab: mini canvas showing current execution state
// - "Steps" tab: accordion of each node execution with I/O
// - "Guardrails" tab: all safety check results
// - "Costs" tab: per-node token usage breakdown
// - "Trace" tab: Langfuse trace link
//
// Sandbox controls:
// - "Clear Session" — new conversation thread
// - "Reset Memory" — clear memory nodes
// - "Export Conversation" — download as JSON
// - "Run Full Test Suite" — trigger all owner tests from this interface
```

### 5.7 Publish Wizard

Multi-step wizard with clear progress indication:

```typescript
// Step 1: Pre-flight Checks (automated)
// Shows list of automated sanity checks with real-time status:
// ✓ Schema validation
// ✓ Guardrail configuration complete  
// ✓ Base prompt assigned (if required)
// ⚠ Warning: 2 nodes have no error handlers
// ✗ Error: Tool "slack" is unhealthy (offline)
// → Cannot proceed if any ERROR-level checks fail

// Step 2: Run Test Suite
// Shows all owner-created tests with pass/fail status
// Triggered automatically when wizard opens
// Shows: test name | type | status | score | duration | trace link
// → Cannot proceed if any test fails
// → "Re-run Failed Tests" button

// Step 3: Release Notes
// Textarea for describing what changed in this version
// Version number displayed (auto-incremented)
// Diff view: what changed from previous published version

// Step 4: Submit for Admin Review
// Summary of checks + tests
// Submit button → triggers Temporal PublishPipelineWorkflow
// Status polling: "Submitted → Sanity Checking → Awaiting Admin → Approved/Rejected"
// Real-time status via WebSocket

// Admin Review Panel (separate page for admins):
// Shows all pending PublishRequests
// For each: Blueprint details | Test results | Sanity checks | Diff
// Approve (with optional note) | Reject (required note)
// Triggers Temporal approval signal
```

### 5.8 Analytics Dashboard

```typescript
// Metrics cards (top row):
// Total Executions (30d) | Success Rate | Avg Latency | Total Cost | 
// Active Blueprints | Pending Approvals

// Charts section:
// - Execution volume over time (line chart, grouped by blueprint)
// - Success/failure rate over time (stacked bar)
// - Cost by blueprint (horizontal bar)
// - Token usage distribution (pie)
// - Latency percentiles (p50/p90/p99) over time

// Execution table (bottom):
// TanStack Table with: execution_id | blueprint | status | duration | 
//                      tokens | cost | triggered_by | timestamp | trace link
// Filterable by: date range | blueprint | status | execution_mode
// Sortable by all columns
// Bulk actions: re-run failed | export CSV
```

---

## 6. API SPECIFICATIONS

### Authentication
```
POST /api/v1/auth/login          → { access_token, refresh_token, user }
POST /api/v1/auth/refresh        → { access_token }
POST /api/v1/auth/logout         → 200 OK
POST /api/v1/auth/api-keys       → { api_key (shown once), key_id }
DELETE /api/v1/auth/api-keys/{id}
```

### Blueprints
```
GET    /api/v1/blueprints              Query: status, type, search, page, limit
POST   /api/v1/blueprints              Body: { name, description, blueprint_type, base_prompt_id? }
GET    /api/v1/blueprints/{id}         Full blueprint with compiled_graph
PUT    /api/v1/blueprints/{id}         Update definition, triggers recompilation
DELETE /api/v1/blueprints/{id}         Soft delete
POST   /api/v1/blueprints/{id}/duplicate
GET    /api/v1/blueprints/{id}/versions
POST   /api/v1/blueprints/{id}/rollback  Body: { version }

# Tests
GET    /api/v1/blueprints/{id}/tests
POST   /api/v1/blueprints/{id}/tests
PUT    /api/v1/blueprints/{id}/tests/{test_id}
DELETE /api/v1/blueprints/{id}/tests/{test_id}
POST   /api/v1/blueprints/{id}/tests/run-all     → triggers Temporal workflow
GET    /api/v1/blueprints/{id}/tests/runs/{run_id}

# Publish
POST   /api/v1/blueprints/{id}/publish/submit    → triggers PublishPipelineWorkflow
GET    /api/v1/blueprints/{id}/publish/status
POST   /api/v1/blueprints/{id}/publish/withdraw

# Validate / estimate
POST   /api/v1/blueprints/{id}/validate    → { valid, errors, warnings }
POST   /api/v1/blueprints/{id}/estimate    → { estimated_tokens, estimated_cost_usd }
```

### Executions
```
POST   /api/v1/executions              Body: { blueprint_id, version?, input_data, mode }
                                       → Returns execution_id immediately
                                       → Starts Temporal workflow async
GET    /api/v1/executions              Query: blueprint_id, status, mode, date_from, date_to
GET    /api/v1/executions/{id}         Full execution with node_executions
POST   /api/v1/executions/{id}/cancel
POST   /api/v1/executions/{id}/retry

# Approvals
GET    /api/v1/executions/{id}/approvals
POST   /api/v1/executions/{id}/approvals/{approval_id}/resolve  Body: { action: approve|reject, notes }
```

### Admin endpoints (admin role required)
```
GET    /api/v1/admin/publish-requests           All pending reviews
GET    /api/v1/admin/publish-requests/{id}
POST   /api/v1/admin/publish-requests/{id}/review  Body: { action: approve|reject, notes }
GET    /api/v1/admin/users                      User management
POST   /api/v1/admin/users/{id}/role            Update role
GET    /api/v1/admin/organizations              Multi-org management
GET    /api/v1/admin/metrics                    Platform-wide metrics
```

### Other resources (standard CRUD)
```
/api/v1/templates        # MessageTemplate CRUD
/api/v1/skills           # Skill CRUD
/api/v1/tools            # MCPTool CRUD + health check
/api/v1/base-prompts     # BasePrompt CRUD (admin only for write)
/api/v1/notifications    # GET (user's) + POST /{id}/read
/api/v1/analytics        # GET /usage, /costs, /executions/summary
```

---

## 7. OBSERVABILITY REQUIREMENTS

### 7.1 Langfuse Integration

Every execution must create a Langfuse trace:

```python
# Trace structure:
trace = langfuse.trace(
    name=f"blueprint:{blueprint.name}",
    id=execution.langfuse_trace_id,
    user_id=str(execution.triggered_by),
    session_id=str(execution.id),
    metadata={
        "blueprint_id": str(execution.blueprint_id),
        "blueprint_version": execution.blueprint_version,
        "execution_mode": execution.execution_mode,
        "org_id": str(blueprint.org_id),
    }
)

# For each LLM node execution:
generation = trace.generation(
    name=f"node:{node.id}:{node_config.model}",
    model=node_config.model,
    input={"messages": messages},
    output=response.content,
    usage={"prompt_tokens": x, "completion_tokens": y},
    metadata={"node_id": node.id, "node_type": "llm"},
)

# For each test run evaluation:
trace.score(
    name="correctness", value=0.92,
    comment="Output matches expected with minor variation"
)
```

### 7.2 Metrics (Prometheus)

Expose at `/metrics` for scraping:
```
# Counters
agent_builder_executions_total{blueprint_id, status, mode}
agent_builder_llm_tokens_total{provider, model, type}
agent_builder_guardrail_triggers_total{check_type, action}
agent_builder_api_requests_total{method, endpoint, status_code}

# Histograms  
agent_builder_execution_duration_seconds{blueprint_id, mode}
agent_builder_node_duration_seconds{node_type, provider}
agent_builder_api_request_duration_seconds{method, endpoint}

# Gauges
agent_builder_active_executions{mode}
agent_builder_pending_approvals
agent_builder_temporal_queue_depth{task_queue}
```

### 7.3 Structured Logging

All log lines must be JSON with fields:
```json
{
  "timestamp": "ISO8601",
  "level": "INFO|WARNING|ERROR",
  "service": "api|temporal-worker|celery-worker",
  "trace_id": "UUID (from X-Request-ID or Temporal run ID)",
  "user_id": "UUID (if authenticated)",
  "org_id": "UUID",
  "event": "descriptive.snake_case.event",
  "duration_ms": 42,
  "extra": {}
}
```

---

## 8. SECURITY REQUIREMENTS

1. **JWT tokens**: RS256 algorithm, 15-minute access tokens, 7-day refresh tokens
2. **API keys**: PBKDF2-SHA256 hashed, shown to user ONCE on creation
3. **Org isolation**: Every DB query MUST include `org_id` filter — add as 
   SQLAlchemy query filter in a base service class method
4. **Role-based access**:
   - `viewer`: read-only access to published blueprints + executions
   - `builder`: create/edit blueprints, run sandbox executions
   - `admin`: all of the above + approve publish requests + manage users + base prompts
5. **Input validation**: All inputs validated with Pydantic v2 strict mode
6. **SQL injection**: NEVER use raw SQL strings — always use SQLAlchemy ORM or 
   parameterized queries
7. **Secrets in node configs**: Scan for patterns resembling API keys/passwords 
   before saving blueprint definition — return error, do not store
8. **Sandboxed code execution**: Use RestrictedPython for Code nodes — whitelist 
   only safe builtins, no file system access, no imports
9. **CORS**: Restrict to known origins in production
10. **Rate limiting**: Per-user AND per-org limits enforced at middleware level
11. **Content Security Policy headers** on all responses
12. **Dependency scanning**: Include `pip-audit` and `npm audit` in CI

---

## 9. SCALABILITY ARCHITECTURE

### Horizontal Scaling Design
```
Load Balancer (nginx)
    ├── API Server Pod 1..N (stateless FastAPI)
    │   └── Connects to: PostgreSQL (via PgBouncer), Redis Cluster, Temporal
    ├── Temporal Worker Pod 1..N (stateless Python workers)
    │   └── Registers: BlueprintExecutionWorker, PublishPipelineWorker, TestWorker
    └── Celery Worker Pod 1..N
        └── Queues: webhooks, cache, reports, notifications

Data Layer:
    PostgreSQL 16 (primary + read replicas)
    Redis 7 Cluster (for rate limiting, pub/sub, session cache)
    Temporal Server (clustered in production)
    Langfuse (self-hosted or cloud)
```

### Temporal Task Queues (define these):
- `blueprint-execution-queue` — Blueprint ExecuteBlueprintWorkflow
- `publish-pipeline-queue` — PublishPipelineWorkflow  
- `test-execution-queue` — TestRunWorkflow
- `notification-queue` — Lightweight notification workflows

### Celery Queues:
- `default` — general tasks
- `webhooks` — webhook delivery (3 retries, exponential backoff)
- `cache` — cache operations
- `reports` — scheduled reports

### Caching Strategy:
```python
# Redis cache keys and TTLs:
f"blueprint:{id}:compiled"   → 3600s  # Compiled graph cache
f"user:{id}:session"         → 900s   # JWT session data
f"org:{id}:tools"            → 300s   # Tool registry
f"rl:{org_id}:{resource}:*"  → 3600s  # Rate limit windows
f"exec:{id}:stream"          → Redis Stream, retain 1h
```

---

## 10. DOCKER COMPOSE (COMPLETE STACK)

Implement a `docker-compose.yml` that starts ALL of:
- `postgres` — PostgreSQL 16 with health check
- `redis` — Redis 7 with persistence
- `temporal` — temporalio/auto-setup:1.24 
- `temporal-ui` — temporalio/ui:2.26
- `langfuse` — langfuse/langfuse:2 with postgres dependency
- `api` — FastAPI app (hot-reload in dev)
- `temporal-worker` — Temporal Python worker
- `celery-worker` — Celery worker
- `flower` — Celery Flower monitoring UI
- `ui` — Vite dev server (with API proxy)

Include a `docker-compose.prod.yml` override with:
- Replicas (api: 3, temporal-worker: 2, celery-worker: 2)
- No hot-reload
- Proper resource limits
- Production logging (JSON)

---

## 11. IMPLEMENTATION SEQUENCE

Follow this sequence strictly. Do NOT jump ahead:

### Phase 1 — Foundation (implement first, nothing else works without this)
1. Monorepo setup: `package.json` (workspaces), `turbo.json`, `.env.example`
2. Docker compose: all services starting cleanly
3. Database: all SQLAlchemy models + initial Alembic migration
4. FastAPI app factory: middleware stack, health endpoint, CORS
5. Auth: JWT login/refresh/logout + API key system
6. Base service class with org isolation pattern

### Phase 2 — Core Backend
7. CRUD services for: Organization, User, BasePrompt, MessageTemplate, Skill, MCPTool
8. Blueprint CRUD + schema validation + compilation (stub compiler first)
9. Temporal client setup + ExecuteBlueprintWorkflow skeleton
10. WebSocket streaming endpoint
11. Guardrails package (all 4 checks)
12. workflow-engine package: BlueprintCompiler (all 10 node types)

### Phase 3 — Execution Pipeline
13. All Temporal activities: LLM, tool, guardrail, streaming
14. Human-in-the-loop approval flow (signal + wait)
15. PublishPipelineWorkflow with sanity checks
16. Test execution: BlueprintTest CRUD + TestRunWorkflow
17. Evaluator package + Langfuse scoring

### Phase 4 — Frontend Foundation
18. Vite + React + Tailwind + shadcn/ui setup with custom theme
19. Auth pages (login + register) with React Hook Form
20. Platform shell: sidebar navigation + header
21. Dashboard page with key metrics
22. TanStack Query API client setup

### Phase 5 — Frontend Core Features
23. Blueprint list page with filters + status badges
24. **Builder Canvas** (most complex — dedicate full attention):
    - React Flow setup with all 10 custom node types
    - Node palette with drag-to-canvas
    - NodeConfigPanel with all config forms
    - Canvas toolbar (undo/redo, validate, estimate cost)
    - Save/load blueprint definition
25. Execution Monitor: real-time canvas overlay + WebSocket
26. Sandbox chat interface

### Phase 6 — Publish + Admin
27. Publish wizard (4-step)
28. Admin approval panel
29. Test management UI
30. Version history + rollback

### Phase 7 — Polish
31. Analytics dashboard (charts + execution table)
32. i18n: complete EN + HE translations with RTL layout
33. Notification system (bell icon + toast)
34. Error boundaries + empty states
35. Accessibility audit (keyboard navigation, ARIA labels)

---

## 12. TESTING REQUIREMENTS

### Backend
```python
# Use pytest + pytest-asyncio + pytest-httpx

# Required test coverage (minimum 80%):
tests/
├── unit/
│   ├── test_blueprint_compiler.py    # All 10 node types compile correctly
│   ├── test_guardrails.py            # All 4 guardrail checks
│   ├── test_cost_estimator.py        # Token/cost estimation accuracy
│   └── test_auth.py                  # JWT + API key validation
├── integration/
│   ├── test_execution_flow.py        # Full execution with Temporal worker
│   ├── test_publish_flow.py          # Full publish pipeline
│   └── test_websocket_streaming.py   # WS message ordering
└── e2e/
    └── test_blueprint_lifecycle.py   # Create → test → publish → execute
```

### Frontend
```typescript
// Use Vitest + React Testing Library + Playwright (E2E)

tests/
├── unit/
│   ├── blueprint-serializer.test.ts  # React Flow ↔ API conversion
│   ├── cost-estimator.test.ts
│   └── canvas-store.test.ts
├── component/
│   ├── LLMNode.test.tsx
│   ├── BuilderCanvas.test.tsx
│   └── PublishWizard.test.tsx
└── e2e/ (Playwright)
    ├── builder-flow.spec.ts           # Create + build + save blueprint
    ├── execution.spec.ts              # Execute + monitor
    └── publish.spec.ts                # Full publish flow
```

---

## 13. ENVIRONMENT VARIABLES (`.env.example`)

```env
# Application
APP_ENV=development
APP_SECRET_KEY=<generate with: openssl rand -hex 32>
APP_HOST=0.0.0.0
APP_PORT=8000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Database
DATABASE_URL=postgresql+asyncpg://agent:secret@localhost:5432/agent_builder
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

# Redis
REDIS_URL=redis://localhost:6379/0
REDIS_CACHE_TTL_DEFAULT=3600

# Temporal
TEMPORAL_HOST=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE_EXECUTION=blueprint-execution-queue
TEMPORAL_TASK_QUEUE_PUBLISH=publish-pipeline-queue
TEMPORAL_TASK_QUEUE_TEST=test-execution-queue

# Celery
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Langfuse
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=http://localhost:3100

# Safety
OPENAI_MODERATION_ENABLED=true
PRESIDIO_ENABLED=true
INJECTION_DETECTION_ENABLED=true

# Auth
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_DEFAULT_EXECUTIONS_PER_HOUR=100

# Feature Flags
SANDBOX_ENABLED=true
CODE_NODE_ENABLED=true
MULTI_ORG_ENABLED=false

# Frontend (Vite)
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
VITE_LANGFUSE_HOST=http://localhost:3100
VITE_APP_ENV=development
```

---

## 14. DELIVERABLES CHECKLIST

Before considering implementation complete, verify ALL of the following exist 
and work:

### Backend
- [ ] All 20+ database models with Alembic migration
- [ ] JWT auth (login/refresh/logout/API keys)
- [ ] All CRUD endpoints (templates, skills, tools, base prompts, blueprints)
- [ ] Blueprint compiler: all 10 node types → LangGraph nodes
- [ ] Temporal: ExecuteBlueprintWorkflow (full, not stub)
- [ ] Temporal: PublishPipelineWorkflow with sanity checks
- [ ] Temporal: TestRunWorkflow with evaluation
- [ ] WebSocket streaming endpoint with Redis pub/sub
- [ ] Guardrails pipeline: moderation + PII + injection + token limits
- [ ] Human-in-the-loop approval flow (Temporal signal)
- [ ] Langfuse tracing on all LLM executions
- [ ] Rate limiting middleware (Redis sliding window)
- [ ] Prometheus metrics endpoint
- [ ] Celery tasks: webhooks, cache, notifications
- [ ] Tests: ≥80% coverage on core logic

### Frontend
- [ ] Custom Tailwind theme + shadcn/ui dark theme
- [ ] All 10 custom React Flow node components
- [ ] Full builder canvas: palette + config panel + toolbar
- [ ] Execution monitor: real-time node status + streaming
- [ ] Sandbox chat interface
- [ ] 4-step publish wizard
- [ ] Admin approval panel
- [ ] Test management UI
- [ ] Analytics dashboard with 5+ charts
- [ ] Complete i18n: EN + HE with RTL layout toggle
- [ ] Notification system
- [ ] Responsive design (works on 1280px+ screens)
- [ ] All TypeScript strict — no `any` types
- [ ] Tests: unit + component + 2 E2E flows

### Infrastructure
- [ ] docker-compose.yml starts all 10 services cleanly
- [ ] `docker-compose up` → platform fully functional in < 3 minutes
- [ ] Health checks on all services
- [ ] Temporal worker registers all activities and workflows
- [ ] Flower accessible at port 5555
- [ ] Langfuse accessible at port 3100
- [ ] Temporal UI accessible at port 8233

---

## 15. QUALITY STANDARDS

### Code Quality
- Python: use `ruff` for linting + formatting, type hints on all functions
- TypeScript: strict mode, no `any`, consistent naming conventions
- All functions/classes have docstrings or JSDoc
- No magic numbers — use named constants
- No TODO comments left in production code

### Architecture Patterns
- Backend: Service layer pattern (routes call services, services call repos)
- Frontend: Feature-based folder structure where possible
- No business logic in route handlers or React components
- Database access only through service/repository layer
- All async Python functions use `async/await` properly

### Error Handling
- Backend: Custom exception hierarchy (AgentBuilderException → specific subtypes)
- All exceptions caught and returned as structured error responses
- Frontend: Error boundaries on all major page sections
- No unhandled promise rejections
- Temporal activities have proper retry policies with sensible limits

---

## 16. KNOWN CONSTRAINTS AND TRADE-OFFS TO DOCUMENT

When implementing, add a `DECISIONS.md` file documenting:
1. Why Temporal over pure Celery for execution orchestration
2. Why LangGraph instead of raw Python state machines
3. PII detection: Presidio vs custom — explain the trade-off
4. Sandboxed code execution: RestrictedPython limitations + alternatives
5. WebSocket vs SSE for streaming — justify choice
6. PostgreSQL for everything vs specialized vector DB — when to reconsider
