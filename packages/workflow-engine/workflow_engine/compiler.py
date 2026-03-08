"""
Blueprint Compiler

Compiles a JSON blueprint definition into a LangGraph StateGraph.
Supports 10 node types: trigger, llm, tool, condition, router,
memory_read, memory_write, approval, code, output.
"""
from typing import Any, Dict, List, TypedDict, Callable
from langgraph.graph import StateGraph, END
from langchain_core.messages import AnyMessage

class ExecutionState(TypedDict):
    """The state passed between nodes in the compiled LangGraph."""
    messages: List[AnyMessage]
    context: Dict[str, Any]
    memory: Dict[str, Any]
    output: Dict[str, Any]
    # For approval workflows
    is_approved: bool


class BlueprintCompiler:
    """Compiles a Blueprint JSON representation into a LangGraph StateGraph."""

    def __init__(self):
        # We can inject registries, evaluators, and tool access here later
        pass

    def compile(self, definition: dict) -> StateGraph:
        """
        Takes a blueprint definition (e.g., from React Flow) and returns a runnable StateGraph.
        """
        nodes = definition.get("nodes", [])
        edges = definition.get("edges", [])

        # Initialize the graph with our state schema
        workflow = StateGraph(ExecutionState)

        # First pass: identify START node (usually a 'trigger' node types without incoming edges)
        target_ids = {edge.get("target") for edge in edges}
        start_nodes = [n for n in nodes if n.get("id") not in target_ids]
        
        if not start_nodes:
            raise ValueError("Invalid Blueprint: No root/trigger node found.")
        
        start_node = start_nodes[0]
        start_node_id = start_node.get("id")

        # Second pass: add all nodes to the graph
        for node in nodes:
            node_id = node.get("id")
            node_type = node.get("type", "unknown")
            node_data = node.get("data", {})
            
            # Create the runnable function for this node
            node_func = self._create_node_executor(node_id, node_type, node_data)
            workflow.add_node(node_id, node_func)

        # Add edges
        # We have to handle conditional edges for condition/router nodes
        conditional_edges = {}
        standard_edges = []

        for edge in edges:
            source = edge.get("source")
            target = edge.get("target")
            source_handle = edge.get("sourceHandle")
            
            source_node = next((n for n in nodes if n.get("id") == source), None)
            if not source_node:
                continue
                
            node_type = source_node.get("type")
            
            if node_type in ["condition", "router", "approval"]:
                # Collect edges mapped to condition outcomes
                if source not in conditional_edges:
                    conditional_edges[source] = {}
                # The source_handle usually dictates the condition branch (e.g. 'true' vs 'false')
                edge_label = source_handle or "default"
                conditional_edges[source][edge_label] = target
            else:
                standard_edges.append((source, target))

        # Apply standard edges
        for source, target in standard_edges:
            workflow.add_edge(source, target)

        # Apply conditional edges
        for source, branch_mapping in conditional_edges.items():
            # For routers/conditions, the previous node state must dictate the branch.
            # We create a router function that looks at state.context.get(source + "_branch")
            workflow.add_conditional_edges(
                source,
                self._create_condition_router(source),
                branch_mapping
            )

        # All terminal nodes (nodes with no outbound edges) wire to END
        source_ids = {edge.get("source") for edge in edges}
        terminal_nodes = [n for n in nodes if n.get("id") not in source_ids]
        
        for node in terminal_nodes:
            node_id = node.get("id")
            workflow.add_edge(node_id, END)

        workflow.set_entry_point(start_node_id)
        
        return workflow.compile()

    def _create_node_executor(self, node_id: str, node_type: str, data: dict) -> Callable:
        """Creates the runtime function for a specific node type mapping to LangGraph."""
        
        def execute_node(state: ExecutionState) -> ExecutionState:
            # We will expand these with actual logic calling out to LLMs, Tools, etc.
            # For now, it scaffolds the 10 node types and modifies context
            
            context = state.get("context", {})
            
            if node_type == "trigger":
                context[f"{node_id}_executed"] = True
                
            elif node_type == "llm":
                prompt = data.get("prompt", "")
                # STUB: Call LLM here
                context[f"{node_id}_result"] = f"LLM Output for {prompt}"
                
            elif node_type == "tool":
                tool_name = data.get("tool_name")
                # STUB: Call MCP Tool here
                context[f"{node_id}_result"] = f"Tool {tool_name} executed"
                
            elif node_type == "condition":
                # STUB: Evaluate JS/Python condition
                condition_expr = data.get("expression", "True")
                is_true = True  # STUB
                context[f"{node_id}_branch"] = "true" if is_true else "false"
                
            elif node_type == "router":
                # STUB: Multi-way routing
                context[f"{node_id}_branch"] = data.get("default_route", "default")
                
            elif node_type == "memory_read":
                key = data.get("key")
                memory_val = state.get("memory", {}).get(key)
                context[f"{node_id}_read"] = memory_val
                
            elif node_type == "memory_write":
                key = data.get("key")
                val = data.get("value")
                if "memory" not in state:
                    state["memory"] = {}
                state["memory"][key] = val
                
            elif node_type == "approval":
                # Returns 'approved' or 'rejected'
                is_approved = state.get("is_approved", False)
                context[f"{node_id}_branch"] = "approved" if is_approved else "rejected"
                
            elif node_type == "code":
                # STUB: Execute RestrictedPython code
                context[f"{node_id}_result"] = "Code executed"
                
            elif node_type == "output":
                output_mapping = data.get("mapping", {})
                state["output"] = output_mapping
            
            state["context"] = context
            return state

        return execute_node

    def _create_condition_router(self, source_id: str) -> Callable:
        """Creates an edge routing function for conditional node flow."""
        def route(state: ExecutionState) -> str:
            # Looks up which branch the source node decided to take
            return state.get("context", {}).get(f"{source_id}_branch", "default")
        return route
