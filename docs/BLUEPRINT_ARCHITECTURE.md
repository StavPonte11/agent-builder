# 🏗️ Blueprint Factory Architecture Guide

## 🎯 The Problem with Code Generation

### What We DON'T Do (The Antipattern)

```python
# ❌ BAD: Code Generation Approach
def generate_agent_code(user_config):
    code = f"""
from langgraph import StateGraph

def my_llm_node(state):
    model = "{user_config['model']}"  # Injection risk!
    # ... generated code
    exec(user_code)  # 🚨 SECURITY HOLE
    
graph = StateGraph()
# ... more generated code
"""
    
    # Save to file
    with open(f"agents/agent_{user_id}.py", "w") as f:
        f.write(code)
    
    # Execute
    exec(code)  # 🚨 Allows arbitrary code execution!
```

### Why This Is Broken

1. **Security Nightmare**
   - `exec()` allows users to run ANY Python code
   - Can access environment variables, secrets, database
   - Can perform DOS attacks
   - Container escape possible

2. **Maintenance Hell**
   - 10,000 users = 10,000 `.py` files
   - Bug fix requires regenerating ALL files
   - Version upgrades impossible
   - Technical debt explodes

3. **State Persistence Fails**
   - Checkpointing breaks when code changes
   - "Node function not found" errors
   - Can't resume threads reliably

## ✅ The Solution: Blueprint Factory Pattern

### What We DO (The Right Way)

```python
# ✅ GOOD: Configuration Interpretation

# 1. User creates configuration (JSON)
blueprint = {
    "blueprint_id": "agent_123",
    "nodes": [
        {
            "id": "reasoning",
            "type": "llm",  # Type from registry
            "config": {     # Just data!
                "model": "gpt-4",
                "temperature": 0.7
            }
        }
    ]
}

# 2. Store in database as JSON
db.execute("INSERT INTO agent_blueprints (blueprint_data) VALUES ($1)", blueprint)

# 3. Compile on-demand using stable functions
factory = GraphFactory()
compiled_graph = factory.compile(blueprint)  # No code generation!

# 4. Execute
result = compiled_graph.invoke(input_data)
```

## 🔑 Key Components

### 1. Blueprint Schema (`blueprint_schema.py`)

The **data structure** that defines an agent:

```python
{
    "blueprint_id": "agent_customer_support",
    "state_schema": "BaseMessageState",
    "nodes": [
        {
            "id": "reasoning",
            "type": "llm",  # Maps to registered runner
            "config": {      # Configuration, not code
                "model": "gpt-4",
                "system_prompt": "You are helpful...",
                "temperature": 0.7
            }
        },
        {
            "id": "tools",
            "type": "mcp_tool_executor",
            "config": {
                "servers": ["google-drive-mcp"],
                "allowed_tools": ["search_files"]
            }
        }
    ],
    "edges": [
        {"source": "reasoning", "target": "tools"}
    ],
    "entry_point": "reasoning"
}
```

**Stored in PostgreSQL as JSONB** - no code files!

### 2. Node Registry (`node_runners.py`)

The **stable Python functions** that execute based on configuration:

```python
async def llm_node_runner(state: State, config: Dict) -> State:
    """
    Generic LLM runner.
    Interprets config to call the right model.
    This function is STABLE - never changes.
    """
    model = config.get("model", "gpt-4")
    temperature = config.get("temperature", 0.7)
    system_prompt = config.get("system_prompt", "")
    
    # Initialize LLM based on config
    llm = ChatOpenAI(model=model, temperature=temperature)
    
    # Execute
    response = await llm.ainvoke(state.messages)
    state.messages.append(response)
    
    return state

# Register this stable function
node_registry.register_runner(NodeType.LLM, llm_node_runner)
```

**Key Insight**: One function handles ALL LLM nodes from ALL users!

### 3. Graph Factory (`graph_factory.py`)

The **compiler** that turns blueprints into executable graphs:

```python
class GraphFactory:
    def compile(self, blueprint: AgentBlueprint) -> StateGraph:
        """
        Compile blueprint into executable graph.
        NO CODE GENERATION!
        """
        graph = StateGraph(State)
        
        # Add nodes
        for node_def in blueprint.nodes:
            # Get stable runner for this node type
            runner = node_registry.get_runner(node_def.type)
            
            # Bind configuration using functools.partial
            # This "bakes in" the config without generating code!
            bound_runner = partial(
                self._execute_node,
                runner=runner,
                config=node_def.config
            )
            
            graph.add_node(node_def.id, bound_runner)
        
        # Add edges
        for edge_def in blueprint.edges:
            graph.add_edge(edge_def.source, edge_def.target)
        
        # Compile
        return graph.compile(checkpointer=self.checkpointer)
```

**Key Insight**: We use `functools.partial` to inject config, not code generation!

### 4. Agent Runtime (`graph_factory.py`)

The **execution engine** with caching and tenant isolation:

```python
class AgentRuntime:
    async def execute(
        self,
        blueprint_id: str,
        input_data: Dict,
        thread_id: str,
        tenant_id: str
    ):
        # Check cache
        cache_key = f"{blueprint_id}_{tenant_id}"
        if cache_key not in self._cache:
            # Compile from blueprint
            compiled = await self.factory.load_and_compile(blueprint_id)
            self._cache[cache_key] = compiled
        
        # Execute with checkpointing
        config = {"configurable": {"thread_id": thread_id}}
        result = await compiled.ainvoke(input_data, config)
        
        return result
```

## 🔐 Security Benefits

### 1. No Code Execution

```python
# ❌ Old way
exec(user_generated_code)  # Can do ANYTHING

# ✅ New way
config = json.loads(user_blueprint)  # Just data
runner(state, config)  # Controlled execution
```

### 2. MCP Isolation

```python
# Tools run in separate processes via MCP
# Your FastAPI server NEVER executes user tool code
# Only routes requests to MCP servers
```

### 3. Tenant Credentials

```python
# Credentials injected at runtime
tenant_creds = await fetch_credentials(user_id, server_id)

# Not stored in blueprint
# Fresh MCP client per execution
# No credential leakage
```

## 📈 Scalability Benefits

### 1. Infinite Agents, One Codebase

```python
# 1 million users
# = 1 million JSON rows in database
# = 1 set of Python files (node_runners.py)

# vs Code Generation:
# = 1 million .py files
# = Impossible to maintain
```

### 2. Hot Fixes

```python
# Find bug in LLM node runner
def llm_node_runner(state, config):
    # Fix bug here
    pass

# ✅ ALL agents instantly fixed
# No regeneration needed
# No testing 1 million files
```

### 3. Version Upgrades

```python
# Upgrade LangGraph from 0.1 to 0.2
pip install langgraph==0.2.0

# ✅ Restart server
# ✅ All agents use new version
# ✅ Zero migration
```

## 🎯 MCP Integration

### Global Server Registry

```python
# Platform maintains catalog of MCP servers
mcp_registry.register_server(MCPServerDefinition(
    server_id="google-drive-mcp",
    name="Google Drive",
    url="http://localhost:3001",
    available_tools=[
        {"name": "search_files", "description": "..."},
        {"name": "read_file", "description": "..."}
    ]
))
```

### User Selection

```python
# User picks servers in UI
blueprint = {
    "nodes": [
        {
            "type": "mcp_tool_executor",
            "config": {
                "servers": ["google-drive-mcp", "slack-mcp"],
                "allowed_tools": ["search_files", "send_message"]
            }
        }
    ]
}
```

### Runtime Execution

```python
# At runtime, factory creates scoped MCP client
async def mcp_tool_executor_runner(state, config):
    servers = config["servers"]
    
    for server_id in servers:
        # Get server definition
        server = mcp_registry.get_server(server_id)
        
        # Get user's credentials
        creds = await get_tenant_credentials(user_id, server_id)
        
        # Create scoped client
        client = MCPClient(server.url, credentials=creds)
        
        # Execute tool
        result = await client.call_tool(tool_name, args)
```

## 📊 Complete Flow

```
┌─────────────────────────────────────────────────────┐
│ 1. User Builds Agent in UI                          │
│    - Drags LLM node                                 │
│    - Drags MCP Tool Executor node                   │
│    - Connects them                                  │
│    - Configures each node                           │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│ 2. Frontend Sends Blueprint JSON                    │
│    POST /api/blueprints/create                      │
│    {                                                 │
│      "nodes": [...],                                │
│      "edges": [...],                                │
│      "config": {...}                                │
│    }                                                 │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│ 3. Backend Validates & Stores                       │
│    - Parse with Pydantic                            │
│    - Validate structure                             │
│    - Store as JSONB in PostgreSQL                   │
│    - NO CODE GENERATION                             │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│ 4. User Executes Agent                              │
│    POST /api/execute                                │
│    {                                                 │
│      "blueprint_id": "agent_123",                   │
│      "input_data": {...}                            │
│    }                                                 │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│ 5. Graph Factory Compiles                           │
│    - Fetch blueprint from DB                        │
│    - Get stable runners from registry               │
│    - Bind configs with functools.partial            │
│    - Build StateGraph                               │
│    - Compile with checkpointer                      │
│    - Cache compiled graph                           │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│ 6. Execute with Isolation                           │
│    - Inject tenant credentials                      │
│    - Create MCP clients                             │
│    - Execute nodes sequentially                     │
│    - Save state to checkpointer                     │
│    - Track in Langfuse                              │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│ 7. Return Results                                   │
│    - Execution complete                             │
│    - State persisted                                │
│    - Can resume from any checkpoint                 │
│    - Zero files generated                           │
└─────────────────────────────────────────────────────┘
```

## 🎓 Key Takeaways

### ✅ DO
- Store configurations (JSON)
- Use stable runner functions
- Compile on-demand
- Cache compiled graphs
- Inject credentials at runtime

### ❌ DON'T
- Generate Python code
- Use exec() or eval()
- Store credentials in blueprints
- Create per-user files
- Mix tenant data

## 🚀 Migration from Old Architecture

If you have existing code generation:

```python
# 1. Extract common patterns into node runners
# Old: 10,000 generated files
# New: 1 llm_node_runner function

# 2. Convert existing agents to blueprints
for agent_file in os.listdir("agents/"):
    config = extract_config_from_code(agent_file)
    blueprint = create_blueprint(config)
    save_to_db(blueprint)

# 3. Delete generated files
shutil.rmtree("agents/")

# 4. Switch execution to factory
# Old: import_module(f"agents.{user_id}")
# New: factory.compile(blueprint_id)
```

## 📚 Further Reading

- LangGraph Checkpointing: https://langchain-ai.github.io/langgraph/concepts/persistence/
- MCP Protocol: https://modelcontextprotocol.io/
- functools.partial: https://docs.python.org/3/library/functools.html#functools.partial

---

**Remember**: Configuration-driven execution is the 2026 standard. No code generation, infinite scalability, complete security.
