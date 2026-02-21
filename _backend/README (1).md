# Unified Workflow & Agent Builder Platform

A production-ready platform for building, testing, and deploying both **workflow automations** and **AI agents** with comprehensive safety controls, evaluation frameworks, and approval workflows.

## 🎯 Key Features

### Unified Builder
- **Single canvas** for both workflows and agents
- **Drag-and-drop** node-based interface
- **Real-time validation** and cost estimation
- **Template system** for quick starts

### Agent-Specific Features
- **Base Prompt System**: Immutable org-level prompts (system admin only)
- **User Prompts**: Owners can add on top of base prompts
- **LLM Nodes**: OpenAI, Anthropic, Google support
- **Memory Nodes**: Redis/Postgres-backed persistence
- **Router Nodes**: Intelligent dynamic routing

### Safety & Guardrails
- **Input/Output Content Filtering** (OpenAI Moderation API)
- **PII Detection & Redaction** (Presidio)
- **Prompt Injection Detection**
- **Token & Cost Limits**
- **Rate Limiting** (per user/agent)

### Testing & Evaluation (Langfuse Integration)
- **Unit Tests**: Test individual nodes
- **Integration Tests**: Full agent/workflow execution
- **LLM-as-a-Judge**: Quality evaluation with scores
- **Performance Benchmarking**: Latency, throughput, cost
- **Datasets & Experiments**: Langfuse-managed test data
- **Trace Logging**: Full execution visibility

### Publishing Workflow
1. **Owner Tests**: Must pass owner-created tests
2. **Platform Sanity Checks**: Automated safety validation
3. **Admin Approval**: Required for all publishes
4. **Version Control**: Full version history and rollback

### Sandbox Environment
- **Interactive Chat**: Test agents before publishing
- **Safe Execution**: Isolated from production
- **Real-time Feedback**: See agent responses immediately
- **Cost Tracking**: Monitor sandbox usage

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Frontend (React + TypeScript)               │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │ Build Canvas │  │ Test Builder  │  │   Sandbox    │ │
│  │  (ReactFlow) │  │               │  │    Chat      │ │
│  └──────────────┘  └───────────────┘  └──────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────┴────────────────────────────────┐
│              Backend (FastAPI + LangGraph)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │  Build   │  │Guardrails│  │ Testing  │  │Approval │ │
│  │  Sync    │  │ Service  │  │ Engine   │  │Pipeline │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                  Data & Storage Layer                    │
│  ┌──────────┐  ┌──────┐  ┌──────────┐  ┌─────────────┐ │
│  │PostgreSQL│  │Redis │  │ Langfuse │  │  Vector DB  │ │
│  │  (Graph) │  │(Mem) │  │ (Traces) │  │  (Embedds)  │ │
│  └──────────┘  └──────┘  └──────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

```bash
# Required
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

# Optional but recommended
- Docker & Docker Compose
```

### Installation

#### Option 1: Docker (Recommended)

```bash
# Clone repository
git clone <repo-url>
cd agent-workflow-builder

# Set up environment
cp backend/.env.example backend/.env
# Edit .env and add your API keys:
# - OPENAI_API_KEY
# - LANGFUSE_PUBLIC_KEY
# - LANGFUSE_SECRET_KEY

# Start all services
docker-compose up -d

# Access the platform
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/docs
# Langfuse: https://cloud.langfuse.com
```

#### Option 2: Manual Setup

**1. Database Setup**

```bash
# Start PostgreSQL and Redis
createdb agent_workflow_builder
psql -d agent_workflow_builder -f database/schema.sql

# Start Redis
redis-server
```

**2. Backend Setup**

```bash
cd backend

python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env with your keys

# Start backend
uvicorn main:app --reload --port 8000
```

**3. Frontend Setup**

```bash
cd frontend

npm install
npm run dev
# Runs on http://localhost:3000
```

## 📊 Usage Guide

### Creating Your First Agent

1. **Navigate to Builder**
   ```
   http://localhost:3000/create
   ```

2. **Choose Type**
   - Select "Agent" (for AI assistant)
   - Or "Workflow" (for automation)

3. **Describe in Natural Language** (Optional)
   ```
   "Create a customer support agent that:
   - Analyzes incoming messages
   - Routes urgent issues to human
   - Responds to common questions
   - Stores conversation history"
   ```

4. **Build Visually**
   - Drag LLM nodes for reasoning
   - Add Tool nodes for external actions
   - Add Memory nodes for context storage
   - Connect with edges

5. **Configure Nodes**
   - Click any node to edit
   - Set LLM parameters (model, temperature, etc.)
   - Configure tools and memory
   - Add prompts

### Testing Your Agent

1. **Create Test Suite**
   ```typescript
   Navigate to "Testing" tab
   Click "Create Test Suite"
   Add test cases:
   - Input: "What are your hours?"
   - Expected: Response contains business hours
   ```

2. **Run Tests**
   ```
   Click "Run Tests"
   View results in real-time
   Check Langfuse for detailed traces
   ```

3. **Sandbox Chat**
   ```
   Click "Try in Sandbox"
   Chat with your agent live
   Monitor responses and behavior
   Iterate on prompts/config
   ```

### Publishing Your Agent

1. **Run Evaluation**
   ```
   Tests must pass ✓
   LLM-as-a-Judge scores > threshold ✓
   Performance metrics acceptable ✓
   No guardrail violations ✓
   ```

2. **Request Approval**
   ```
   Click "Request Publish"
   System runs sanity checks automatically
   Request sent to admin
   ```

3. **Admin Reviews**
   ```
   Admin sees:
   - Test results
   - Evaluation scores
   - Guardrail checks
   - Code review (LangGraph)
   
   Admin can:
   - Approve
   - Reject (with reason)
   - Request changes
   ```

4. **Agent Published**
   ```
   Status changes to "Published"
   Agent is now available as a tool
   Version created and tracked
   Can be used in other agents/workflows
   ```

## 🔒 Security & Safety

### Base Prompts (System Admin Only)

```python
# Only system admins can create/edit base prompts
# These are IMMUTABLE for regular users

# Example base prompt:
"""
You are a helpful AI assistant. Follow these core principles:
1. Be truthful and accurate
2. Prioritize user safety and privacy  
3. Respect ethical guidelines
4. Admit when you don't know something
5. Never share personally identifiable information
"""

# Agent owners can only ADD to this, not modify it
```

### Guardrails in Action

```python
# Input Guardrails (before LLM)
✓ Content moderation (harmful content)
✓ PII detection (emails, SSNs, etc.)
✓ Prompt injection detection
✓ Token limits

# Output Guardrails (after LLM)
✓ Content moderation
✓ PII leakage check
✓ Hallucination detection (optional)
✓ Cost limits
```

### Rate Limiting

```python
# Per-agent, per-user limits
- 60 requests/minute
- 1000 requests/hour  
- 10000 requests/day
- 4000 tokens/request
- 5 concurrent executions max

# Configurable per agent
# Tracked in database
# Automatic throttling
```

## 🧪 Testing with Langfuse

### Dataset Creation

```python
# In Langfuse UI:
1. Create dataset: "customer_support_qa"
2. Add test items:
   {
     "input": "What are your hours?",
     "expected_output": "9 AM - 5 PM EST",
     "metadata": {"intent": "hours_query"}
   }

# In your agent tests:
test_suite.langfuse_dataset_id = "customer_support_qa"
```

### Running Experiments

```python
# Create experiment in code
experiment = langfuse.create_experiment(
    name="agent_v2_evaluation",
    dataset_id="customer_support_qa"
)

# Run agent on dataset
for item in dataset:
    result = agent.run(item.input)
    experiment.add_run(
        input=item.input,
        output=result,
        expected=item.expected_output,
        scores=llm_judge_scores
    )

# View in Langfuse UI
# Compare experiments
# Track performance over time
```

### LLM-as-a-Judge

```python
# Automatic quality scoring
judge_prompt = """
Evaluate this agent response:

Input: {input}
Output: {output}

Rate 1-10 on:
1. Accuracy
2. Helpfulness  
3. Safety
4. Tone

Provide reasoning for each score.
"""

# Scores logged to Langfuse
# Visible in evaluation dashboard
# Can set minimum thresholds for publishing
```

## 📈 Monitoring & Observability

### Real-time Metrics

```
Build Performance Dashboard:
- Total executions
- Success rate
- Average latency (p50, p95, p99)
- Token usage
- Cost per execution
- Guardrail violations
```

### Langfuse Integration

```
Every execution:
1. Creates Langfuse trace
2. Logs all nodes
3. Records tokens/cost
4. Links to evaluation scores

View in Langfuse:
- Full execution tree
- Node-level timing
- Prompt/completion pairs
- Error stack traces
```

### Alerts & Notifications

```python
# Automatic alerts on:
- High error rate (>5%)
- Guardrail violations
- Cost overruns
- Rate limit hits
- Publishing events

# Delivered via:
- Email
- Slack
- Webhook
```

## 🔄 Version Control & Rollback

### Automatic Versioning

```python
# Every publish creates a version
Version 1: Initial release
Version 2: Updated prompts
Version 3: Added memory node

# Each version stores:
- Complete graph snapshot
- LangGraph code
- Performance metrics
- Change notes
```

### Rollback Process

```python
# If v3 has issues:
1. Navigate to "Versions"
2. Select v2
3. Click "Rollback"
4. Instant restore to v2
5. v4 created (rollback from v3)

# No data loss
# Preserves audit trail
# Can re-rollback if needed
```

## 🎨 Customization

### Custom Node Types

```python
# Add new node type
class CustomToolNode(BuildNode):
    type = NodeType.CUSTOM_TOOL
    config: CustomToolConfig
    
# Register in sync manager
# Add UI component
# Deploy
```

### Custom Guardrails

```python
# Implement custom guardrail
class ComplianceGuardrail:
    async def check(self, text: str) -> GuardrailResult:
        # Your compliance logic
        return GuardrailResult(...)

# Register with service
guardrail_service.register("compliance", ComplianceGuardrail())
```

### Custom Evaluators

```python
# Add custom evaluation metric
class CustomMetric:
    def evaluate(self, output: str) -> float:
        # Your scoring logic
        return score

# Use in test suite
test_suite.add_evaluator(CustomMetric())
```

## 📚 API Reference

### Key Endpoints

```
# Build Management
POST   /api/builds/create              # Create agent/workflow
GET    /api/builds/{id}                # Get build
PUT    /api/builds/{id}/graph          # Update graph
DELETE /api/builds/{id}                # Delete build

# Testing
POST   /api/builds/{id}/tests          # Create test suite
POST   /api/builds/{id}/tests/{tid}/run  # Run tests
GET    /api/builds/{id}/evaluations    # Get evaluations

# Sandbox
POST   /api/sandbox/{id}/chat          # Chat with agent
GET    /api/sandbox/{id}/history       # Get chat history

# Publishing
POST   /api/builds/{id}/publish        # Request publish
POST   /api/approvals/{id}/approve     # Approve (admin)
POST   /api/approvals/{id}/reject      # Reject (admin)

# Execution
POST   /api/builds/{id}/execute        # Execute
GET    /api/builds/{id}/executions     # Get history

# Admin
POST   /api/prompts/base               # Create base prompt (system admin)
GET    /api/prompts/base               # Get active base prompt
```

## 🐛 Troubleshooting

### Common Issues

**"Guardrail failed: PII detected"**
```
Solution: Enable PII redaction in guardrail config
Or: Remove PII from input before processing
```

**"Rate limit exceeded"**
```
Solution: Wait for rate limit window to reset
Or: Increase limits in build config (if approved)
```

**"Test failed: Output mismatch"**
```
Solution: Update expected output in test case
Or: Fix agent logic to produce correct output
Check Langfuse trace for debugging
```

**"Admin rejected publish"**
```
Solution: Check rejection reason
Address issues mentioned
Re-run evaluation
Re-submit for approval
```

## 🚢 Deployment

### Production Checklist

- [ ] Environment variables set correctly
- [ ] Database properly configured and backed up
- [ ] Redis configured with persistence
- [ ] Langfuse project set up
- [ ] Rate limits configured appropriately
- [ ] Guardrails enabled and tested
- [ ] Base prompts reviewed and approved
- [ ] Admin users assigned
- [ ] Monitoring and alerts configured
- [ ] SSL/TLS certificates installed

### Scaling Considerations

```python
# Horizontal scaling
- Multiple backend instances (stateless)
- Load balancer (nginx/ALB)
- Database read replicas
- Redis cluster for memory

# Vertical scaling
- Larger DB instance for heavy workloads
- More Redis memory for agents with large context
- GPU instances for local LLM nodes (future)
```

## 📞 Support

- **Documentation**: Full docs in `/docs`
- **Issues**: GitHub Issues
- **Email**: support@example.com
- **Langfuse**: https://langfuse.com/docs

## 🤝 Contributing

We welcome contributions! See CONTRIBUTING.md for guidelines.

## 📄 License

MIT License - see LICENSE file

---

Built with ❤️ using React, TypeScript, FastAPI, LangGraph, LangChain, and Langfuse.
