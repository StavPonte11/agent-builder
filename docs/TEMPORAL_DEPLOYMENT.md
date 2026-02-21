# 🚀 Temporal.io + Full Observability Deployment Guide

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    USER REQUESTS                             │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                 FastAPI Backend (main_temporal.py)           │
│  - Validates blueprints                                      │
│  - Starts Temporal workflows                                 │
│  - Exposes Prometheus metrics (:8001/metrics)                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              Temporal.io Server (:7233)                      │
│  - Workflow orchestration                                    │
│  - Durable execution                                         │
│  - Automatic retries                                         │
│  - Full execution history                                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┬──────────┐
        ▼                     ▼          ▼
┌──────────────┐      ┌──────────────┐  ...
│Temporal      │      │Temporal      │
│Worker 1      │      │Worker 2      │
│(:8002)       │      │(:8003)       │
└──────┬───────┘      └──────┬───────┘
       │                     │
       │   Execute nodes     │
       │   (LLM, MCP tools)  │
       │                     │
       └─────────┬───────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐
│Postgres│  │ Redis  │  │OpenAI  │
│(data)  │  │(cache) │  │(LLM)   │
└────────┘  └────────┘  └────────┘
    │
    │ Metrics Collection
    ▼
┌─────────────────────────────────────────────────────────────┐
│              Prometheus (:9090)                              │
│  - Scrapes /metrics from all services                        │
│  - Stores time-series data                                   │
│  - Evaluates alerting rules                                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              Grafana (:3001)                                 │
│  - Visualizes metrics                                        │
│  - Pre-built dashboards                                      │
│  - Real-time monitoring                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Langfuse (External)                             │
│  - LLM call tracing                                          │
│  - Token tracking                                            │
│  - Cost analysis                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start (Docker Compose)

### 1. Prerequisites

```bash
# Install Docker & Docker Compose
docker --version  # Should be 20.10+
docker-compose --version  # Should be 2.0+

# Get Langfuse keys (free tier)
# Visit: https://cloud.langfuse.com
# Create account and copy keys
```

### 2. Environment Setup

```bash
cd agent-workflow-builder

# Create environment file
cat > backend/.env << EOF
# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/agent_workflow_builder

# Redis
REDIS_URL=redis://redis:6379

# Temporal
TEMPORAL_HOST=temporal:7233

# OpenAI
OPENAI_API_KEY=sk-your-openai-key-here

# Langfuse
LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key
LANGFUSE_SECRET_KEY=sk-lf-your-secret-key
LANGFUSE_HOST=https://cloud.langfuse.com

# Prometheus
PROMETHEUS_PORT=8001
EOF
```

### 3. Start Everything

```bash
# Start all services
docker-compose -f docker-compose-temporal.yml up -d

# Check services are running
docker-compose -f docker-compose-temporal.yml ps

# Expected output:
# temporal           Running   
# temporal-ui        Running   
# backend            Running   
# temporal-worker    Running (3 replicas)
# postgres           Running   
# redis              Running   
# prometheus         Running   
# grafana            Running   
```

### 4. Access Dashboards

```bash
# Frontend
open http://localhost:3000

# Temporal UI (workflow visualization)
open http://localhost:8080

# Grafana (metrics dashboards)
open http://localhost:3001
# Login: admin / admin

# Prometheus (raw metrics)
open http://localhost:9090

# API Docs
open http://localhost:8000/docs
```

## 📊 Monitoring & Observability

### Prometheus Metrics

**Available at:** `http://localhost:8000/metrics` (backend) and `http://localhost:8002/metrics` (workers)

#### Execution Metrics

```promql
# Total executions
sum(agent_execution_total)

# Success rate
sum(rate(agent_execution_total{status="completed"}[5m])) 
/ sum(rate(agent_execution_total[5m])) * 100

# P95 latency
histogram_quantile(0.95, 
  sum(rate(agent_execution_duration_milliseconds_bucket[5m])) by (le)
)

# Currently running
sum(agent_execution_in_progress)

# Error rate
sum(rate(agent_execution_errors_total[5m]))
```

#### LLM Metrics

```promql
# LLM call rate
sum(rate(llm_calls_total[5m])) by (model)

# LLM latency
histogram_quantile(0.95, 
  sum(rate(llm_latency_milliseconds_bucket[5m])) by (le, model)
)

# Total LLM cost
sum(llm_cost_usd_total)

# Token usage
sum(rate(llm_tokens_total_sum[5m])) by (model, type)
```

#### MCP Tool Metrics

```promql
# Tool call rate
sum(rate(mcp_tool_calls_total[5m])) by (server_id, tool_name)

# Tool error rate
sum(rate(mcp_tool_errors_total[5m])) by (server_id, error_type)

# Tool latency
histogram_quantile(0.95,
  sum(rate(mcp_tool_latency_milliseconds_bucket[5m])) by (le, tool_name)
)
```

#### Temporal Workflow Metrics

```promql
# Workflow starts
sum(rate(temporal_workflow_starts_total[5m]))

# Workflow completion rate by status
sum(rate(temporal_workflow_completions_total[5m])) by (status)

# Activity retry rate
sum(rate(temporal_activity_retries_total[5m])) by (activity_type)
```

### Grafana Dashboard

**Pre-configured dashboard includes:**

1. **Overview Panel**
   - Total executions (24h)
   - Success rate (gauge)
   - P95 latency
   - Total cost
   - Active executions
   - Error rate

2. **Execution Performance**
   - Duration over time (p50, p95, p99)
   - Executions per minute by blueprint
   - Node-level timing

3. **LLM Performance**
   - Call latency by provider/model
   - Token usage breakdown
   - Cost per model (pie chart)

4. **MCP Tools**
   - Tool call rate
   - Tool error rate
   - Tool-specific latency

5. **Errors & Failures**
   - Error rate by type
   - Recent errors table
   - Error distribution

6. **Guardrails**
   - Violation rate by type
   - Check results (pass/fail pie chart)

7. **System Resources**
   - Database query duration
   - Connection pool utilization
   - API request rate

8. **Business Metrics**
   - Active users (5m, 1h, 24h)
   - Active blueprints by status
   - Platform cost
   - Avg cost per execution

9. **Temporal Workflows**
   - Workflow starts vs completions
   - Activity retry rate
   - Workflow duration distribution

### Langfuse Tracing

**Every execution creates traces with:**

- Full conversation history
- Token counts (prompt + completion)
- Cost breakdown
- Latency per LLM call
- Node-level spans
- LLM-as-a-Judge scores

**Access:** https://cloud.langfuse.com/project/YOUR_PROJECT/traces

## 🔍 Temporal UI Deep Dive

### View Workflow Execution

1. Navigate to http://localhost:8080
2. Click "Workflows" → Find your workflow
3. See:
   - Current state
   - Execution history
   - Activity completions
   - Retries
   - Input/Output
   - Stack traces (if failed)

### Example Workflow View

```
Workflow: AgentExecutionWorkflow
Status: Running
Started: 2025-02-13 10:30:00

Events:
✓ WorkflowStarted
✓ ActivityScheduled: fetch_blueprint
✓ ActivityCompleted: fetch_blueprint (150ms)
✓ ActivityScheduled: execute_node (node_id: reasoning)
⏳ ActivityStarted: execute_node
  └─ Retry attempt: 1/3
  └─ Current duration: 2.3s
```

### Retry & Fault Tolerance

Temporal automatically retries failed activities:

```python
# In temporal_workflows.py
retry_policy=RetryPolicy(
    maximum_attempts=3,
    initial_interval=timedelta(seconds=2),
    backoff_coefficient=2.0
)
```

**Result:** If an LLM call fails, Temporal retries with exponential backoff (2s, 4s, 8s).

## 🎯 Testing the System

### 1. Create a Blueprint

```bash
curl -X POST http://localhost:8000/api/blueprints/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent",
    "description": "Simple test",
    "blueprint_data": {
      "blueprint_id": "test_001",
      "nodes": [
        {
          "id": "llm1",
          "type": "llm",
          "config": {
            "model": "gpt-4",
            "temperature": 0.7,
            "system_prompt": "You are helpful",
            "max_tokens": 500
          }
        }
      ],
      "edges": [],
      "entry_point": "llm1"
    },
    "owner_id": "user_123",
    "organization_id": "org_456"
  }'
```

### 2. Execute via Temporal

```bash
curl -X POST http://localhost:8000/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "blueprint_id": "BLUEPRINT_ID_FROM_STEP_1",
    "user_id": "user_123",
    "organization_id": "org_456",
    "input_data": {
      "messages": [
        {"role": "user", "content": "Hello!"}
      ]
    },
    "environment": "production"
  }'

# Response:
{
  "workflow_id": "agent-exec-test_001-thread_abc",
  "thread_id": "thread_abc",
  "status": "started",
  "temporal_ui": "http://localhost:8080/namespaces/default/workflows/agent-exec-test_001-thread_abc"
}
```

### 3. Check Status

```bash
# Get workflow status
curl http://localhost:8000/api/execute/WORKFLOW_ID/status

# Get final result (blocks until complete)
curl http://localhost:8000/api/execute/WORKFLOW_ID/result
```

### 4. View in Dashboards

- **Temporal UI:** See workflow execution in real-time
- **Grafana:** Watch metrics update
- **Langfuse:** See LLM traces

## 📈 Scaling

### Horizontal Scaling (Workers)

```yaml
# In docker-compose-temporal.yml
temporal-worker:
  deploy:
    replicas: 10  # Scale to 10 workers
```

**Result:** 10 workers process workflows in parallel. Temporal automatically distributes work.

### Vertical Scaling (Resources)

```yaml
temporal-worker:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 4G
      reservations:
        cpus: '1'
        memory: 2G
```

### Database Scaling

```bash
# Use connection pooling
DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/dbname?min_size=10&max_size=100
```

## 🚨 Alerting

### Prometheus Alerts (prometheus.yml)

```yaml
# Example alert rules
groups:
  - name: agent_platform
    rules:
      - alert: HighErrorRate
        expr: sum(rate(agent_execution_errors_total[5m])) > 1
        for: 5m
        annotations:
          summary: "High error rate detected"
          
      - alert: HighLatency
        expr: histogram_quantile(0.95, sum(rate(agent_execution_duration_milliseconds_bucket[5m])) by (le)) > 30000
        for: 10m
        annotations:
          summary: "P95 latency above 30s"
          
      - alert: HighLLMCost
        expr: sum(increase(llm_cost_usd_total[1h])) > 100
        annotations:
          summary: "LLM cost exceeded $100/hour"
```

## 🔧 Troubleshooting

### Worker Not Processing

```bash
# Check worker logs
docker-compose -f docker-compose-temporal.yml logs temporal-worker

# Check Temporal connectivity
docker exec -it temporal tctl workflow list
```

### Metrics Not Appearing

```bash
# Check Prometheus targets
open http://localhost:9090/targets

# Should show:
# - backend:8001 (UP)
# - temporal-worker:8002 (UP)
# - temporal:8233 (UP)

# Test metrics endpoint directly
curl http://localhost:8000/metrics
```

### Workflow Stuck

```bash
# View in Temporal UI
open http://localhost:8080

# Cancel if needed
curl -X POST http://localhost:8000/api/execute/WORKFLOW_ID/cancel
```

## 🎓 Key Benefits Achieved

### ✅ Distributed Execution
- Workers can run on different machines
- Automatic load balancing
- Horizontal scaling

### ✅ Fault Tolerance
- Survives process crashes
- Automatic retries
- Durable state

### ✅ Full Observability
- Prometheus metrics (latency, errors, cost)
- Grafana dashboards (real-time visualization)
- Langfuse traces (LLM-level detail)
- Temporal UI (workflow visualization)

### ✅ Production Ready
- No code generation
- Secure (no exec)
- Scalable (add workers)
- Observable (every metric tracked)

## 📊 Metrics Summary

**You now track:**

- ✅ Execution count, duration, status
- ✅ LLM calls, tokens, cost by model
- ✅ MCP tool usage and errors
- ✅ Guardrail violations
- ✅ Database query performance
- ✅ API request rates
- ✅ Temporal workflow health
- ✅ Business metrics (users, cost)
- ✅ System resources

**All visualized in Grafana with pre-built dashboard!**

## 🚀 Production Deployment

For production, update:

1. **Use managed Temporal Cloud**
   ```bash
   TEMPORAL_HOST=namespace.account.tmprl.cloud:7233
   ```

2. **Use managed Postgres** (AWS RDS, etc.)

3. **Use managed Redis** (AWS ElastiCache, etc.)

4. **Configure alerts** (PagerDuty, Slack)

5. **Enable HTTPS** (Traefik, Nginx)

6. **Set up backup** (automated snapshots)

---

**You now have a production-grade, distributed, fully observable agent execution platform!** 🎉
