"""
graph_factory.py — Compile LangGraph workflow from a BlueprintSchema

Bug fix: conditional edges now use add_conditional_edges() with a route
extractor that reads the last AIMessage content (produced by the `router` node).
"""

from typing import Any, Dict
from functools import partial

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from blueprint_schema import BlueprintSchema, EdgeSchema
from node_runners import NodeRegistry, AgentState
from database import get_checkpointer


def _make_route_fn(edges: list[EdgeSchema]):
    """
    Build a LangGraph route function that maps the last AIMessage content
    (the route key emitted by the `router` node) to a target node id.
    Falls back to "default" → first non-conditional edge.
    """
    route_map: dict[str, str] = {}
    default_target: str | None = None

    for edge in edges:
        if edge.condition and edge.condition not in ("default", ""):
            route_map[edge.condition] = edge.target
        else:
            default_target = edge.target

    # All possible values must be declared for LangGraph to type-check
    all_targets = list({e.target for e in edges if e.target != "__end__"})

    def route_fn(state: AgentState) -> str:
        msgs = state.get("messages", [])
        if msgs:
            key = msgs[-1].content.strip().lower() if hasattr(msgs[-1], "content") else ""
            if key in route_map:
                return route_map[key]
        return default_target or all_targets[0]

    return route_fn, all_targets


class GraphFactory:
    def __init__(self):
        pass

    async def compile(self, blueprint: BlueprintSchema, checkpointer: AsyncPostgresSaver) -> Any:
        workflow = StateGraph(AgentState)

        # 1. Add Nodes
        for node in blueprint.nodes:
            runner_func = NodeRegistry.get_runner(node.type)
            config_dict = node.config.model_dump()
            configured_runner = partial(runner_func, config=config_dict)
            workflow.add_node(node.id, configured_runner)

        # 2. Build adjacency list
        adjacency: dict[str, list[EdgeSchema]] = {node.id: [] for node in blueprint.nodes}
        for edge in blueprint.edges:
            adjacency[edge.source].append(edge)

        # 3. Add Edges — simple or conditional
        for source_id, edges in adjacency.items():
            if not edges:
                # Terminal node → END
                workflow.add_edge(source_id, END)
                continue

            conditional_edges = [e for e in edges if e.condition]
            if len(edges) == 1 and not conditional_edges:
                # Simple linear edge
                target = edges[0].target
                if target == "__end__":
                    workflow.add_edge(source_id, END)
                else:
                    workflow.add_edge(source_id, target)
            else:
                # Conditional routing: the `router` node writes its decision into
                # the last messages content. We build a route function from the
                # condition labels on each outgoing edge.
                route_fn, all_targets = _make_route_fn(edges)
                workflow.add_conditional_edges(
                    source_id,
                    route_fn,
                    {t: t for t in all_targets},
                )

        # 4. Entry point + compile
        workflow.set_entry_point(blueprint.entry_point)
        app = workflow.compile(checkpointer=checkpointer)
        return app
