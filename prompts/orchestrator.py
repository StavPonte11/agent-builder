"""
LangGraph Orchestrator — Infrastructure Agentic Workflow
=========================================================
ReAct-pattern orchestrator using LangGraph StateGraph.
Processes reports → resolves entities → runs impact analysis → executes action queue.

DEPENDENCIES:
  pip install langgraph langchain langchain-openai langfuse langchain-postgres

ENVIRONMENT:
  OPENAI_API_KEY, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY,
  LANGFUSE_HOST, INFRA_API_BASE_URL, DATABASE_URL (postgres for checkpointer)
"""

from __future__ import annotations
import os
import json
import logging
import asyncio
import httpx
from datetime import datetime
from typing import TypedDict, Annotated, Optional, List, Dict, Any, Literal

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.prebuilt import ToolNode
from langfuse import Langfuse
from langfuse.callback import CallbackHandler

logger = logging.getLogger(__name__)

INFRA_API = os.getenv("INFRA_API_BASE_URL", "http://localhost:8000/api/v1")
LANGFUSE_HOST = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")

# ---------------------------------------------------------------------------
# LangFuse setup
# ---------------------------------------------------------------------------

langfuse = Langfuse(
    public_key=os.getenv("LANGFUSE_PUBLIC_KEY", ""),
    secret_key=os.getenv("LANGFUSE_SECRET_KEY", ""),
    host=LANGFUSE_HOST,
)


# ---------------------------------------------------------------------------
# Workflow State
# ---------------------------------------------------------------------------

class WorkflowState(TypedDict):
    """
    Full state carried across all LangGraph nodes.
    The PostgreSQL checkpointer persists this between steps for resumability.
    """
    # Core conversation
    messages:           Annotated[list, add_messages]
    task_id:            str                     # LangFuse trace correlation ID
    task_description:   str

    # Classification & resolution
    report_text:        Optional[str]
    trigger_type:       str                     # report | alert | manual | schedule
    report_category:    Optional[str]           # infrastructure | security | maintenance | unrelated
    is_relevant:        bool
    confidence_score:   float

    # Resolved graph entities
    resolved_sites:     List[str]
    resolved_facilities: List[str]

    # Analysis results
    analysis_result:    Optional[Dict[str, Any]]  # Full AnalysisResult from /agent/analyze
    escalation_level:   int                       # 0=normal, 1=elevated, 2=critical
    has_viable_backup:  bool

    # Action execution
    action_queue:       List[Dict[str, Any]]    # ActionItem list from analysis
    completed_actions:  List[str]               # Completed action_ids
    failed_actions:     List[str]

    # Human-in-the-loop
    pending_approval:   Optional[Dict[str, Any]]  # ActionItem awaiting approval
    approval_granted:   Optional[bool]

    # Output
    final_summary:      Optional[str]
    workflow_status:    str                     # running | completed | failed | awaiting_approval


# ---------------------------------------------------------------------------
# Infra API client
# ---------------------------------------------------------------------------

class InfraAPIClient:
    """Async client for the Infrastructure Dependency Graph API."""

    def __init__(self, base_url: str = INFRA_API):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)

    async def analyze(self, report_text: str = None, site_names: List[str] = None,
                      coordinates: List[Dict] = None, trigger_type: str = "report") -> Dict:
        payload = {
            "trigger_type": trigger_type,
            "site_names":   site_names or [],
            "coordinates":  coordinates or [],
        }
        if report_text:
            payload["report_text"] = report_text
        resp = await self.client.post(f"{self.base_url}/agent/analyze", json=payload)
        resp.raise_for_status()
        return resp.json()

    async def get_site_context(self, site_name: str) -> Dict:
        resp = await self.client.get(f"{self.base_url}/agent/context/site/{site_name}")
        resp.raise_for_status()
        return resp.json()

    async def resolve(self, fuzzy_sites: List[str] = None, coordinates: List[Dict] = None) -> Dict:
        payload = {
            "fuzzy_site_names": fuzzy_sites or [],
            "coordinates":      coordinates or [],
        }
        resp = await self.client.post(f"{self.base_url}/agent/resolve", json=payload)
        resp.raise_for_status()
        return resp.json()

    async def get_impact(self, site_name: str) -> Dict:
        resp = await self.client.get(f"{self.base_url}/impact/site/{site_name}")
        resp.raise_for_status()
        return resp.json()

    async def close(self):
        await self.client.aclose()


infra_client = InfraAPIClient()


# ---------------------------------------------------------------------------
# LLM
# ---------------------------------------------------------------------------

llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0,
    api_key=os.getenv("OPENAI_API_KEY"),
)

CLASSIFY_SYSTEM = """You are an infrastructure intelligence analyst.
Given a report or alert text, classify it and extract entities.

Respond ONLY with valid JSON matching this schema:
{
  "is_relevant": bool,
  "category": "infrastructure" | "security" | "maintenance" | "operational" | "unrelated",
  "confidence": float (0-1),
  "extracted_sites": [str],
  "extracted_facilities": [str],
  "extracted_coordinates": [{"lat": float, "lon": float}],
  "event_type": str | null,
  "reasoning": str
}

is_relevant=true only if the report describes a physical infrastructure event
(outage, damage, attack on a site/facility, power loss, etc.)."""

SUMMARY_SYSTEM = """You are an operations briefing officer.
Given an infrastructure impact analysis result, write a concise 3-5 sentence
operational brief suitable for a senior commander. Include: what happened,
what efforts are degraded, backup status, and immediate actions required.
Be direct, factual, and use military/operational brevity style."""


# ---------------------------------------------------------------------------
# Graph Nodes
# ---------------------------------------------------------------------------

async def classify_report(state: WorkflowState) -> Dict:
    """
    Node 1: Classify the report and determine if it's infrastructure-relevant.
    Uses LLM to extract entities, coordinates, and event type.
    """
    trace = langfuse.trace(name="classify_report", id=state["task_id"])

    if not state.get("report_text"):
        # No text — assume manual trigger with pre-identified sites
        return {
            "is_relevant": True,
            "report_category": "infrastructure",
            "confidence_score": 1.0,
            "workflow_status": "running",
        }

    span = trace.span(name="llm_classification")
    try:
        response = await llm.ainvoke([
            SystemMessage(content=CLASSIFY_SYSTEM),
            HumanMessage(content=f"Report:\n{state['report_text']}"),
        ])
        result = json.loads(response.content)
        span.end(output=result)

        # Auto-resolve coordinates from report
        coords = result.get("extracted_coordinates", [])
        resolved_from_text = result.get("extracted_sites", [])

        trace.score(name="classification_confidence", value=result.get("confidence", 0.5))

        return {
            "is_relevant":      result.get("is_relevant", False),
            "report_category":  result.get("category", "unrelated"),
            "confidence_score": result.get("confidence", 0.5),
            "resolved_sites":   state.get("resolved_sites", []) + resolved_from_text,
            "resolved_facilities": state.get("resolved_facilities", []) + result.get("extracted_facilities", []),
            "workflow_status":  "running",
            "messages": [AIMessage(content=f"Classification: {result.get('reasoning', '')}")]
        }
    except Exception as e:
        span.end(level="ERROR", status_message=str(e))
        logger.error(f"Classification failed: {e}")
        return {"is_relevant": False, "confidence_score": 0.0, "workflow_status": "running"}


async def resolve_and_analyze(state: WorkflowState) -> Dict:
    """
    Node 2: Call /agent/analyze with all known entities and coordinates.
    Returns full AnalysisResult including typed action queue.
    """
    trace = langfuse.trace(name="resolve_analyze", id=state["task_id"])
    span = trace.span(name="infra_api_analyze")

    try:
        result = await infra_client.analyze(
            report_text=state.get("report_text"),
            site_names=state.get("resolved_sites", []),
            trigger_type=state.get("trigger_type", "report"),
        )
        span.end(output={
            "resolved_sites":     result.get("resolved_sites"),
            "escalation_level":   result.get("escalation_level"),
            "action_count":       len(result.get("action_queue", [])),
        })

        trace.score(name="entity_resolution_confidence", value=result.get("confidence_score", 0))

        return {
            "analysis_result":    result,
            "resolved_sites":     result.get("resolved_sites", []),
            "resolved_facilities":result.get("resolved_facilities", []),
            "escalation_level":   result.get("escalation_level", 0),
            "has_viable_backup":  result.get("has_viable_backup", True),
            "action_queue":       result.get("action_queue", []),
            "confidence_score":   result.get("confidence_score", 0.5),
            "workflow_status":    "running",
            "messages": [AIMessage(content=result.get("risk_summary", "Analysis complete."))]
        }
    except Exception as e:
        span.end(level="ERROR", status_message=str(e))
        logger.error(f"Analysis failed: {e}")
        return {"workflow_status": "failed", "final_summary": f"Analysis failed: {e}"}


async def execute_actions(state: WorkflowState) -> Dict:
    """
    Node 3: Execute the action queue.
    - Checks requires_approval — pauses for human confirmation if needed
    - Dispatches tool calls based on tool_hint
    - Records completed/failed action IDs
    """
    action_queue  = state.get("action_queue", [])
    completed     = list(state.get("completed_actions", []))
    failed        = list(state.get("failed_actions", []))
    completed_ids = set(completed)

    for action in action_queue:
        action_id   = action.get("action_id")
        if action_id in completed_ids:
            continue

        # Check dependencies
        deps = action.get("depends_on", [])
        if any(dep not in completed_ids for dep in deps):
            continue

        # Human-in-the-loop gate
        if action.get("requires_approval") and state.get("approval_granted") is not True:
            return {
                "pending_approval":  action,
                "workflow_status":   "awaiting_approval",
                "messages": [AIMessage(content=f"⏸ Awaiting approval for: {action.get('description')}")]
            }

        # Dispatch by tool_hint
        tool_hint = action.get("tool_hint", "")
        try:
            await _dispatch_tool(action, tool_hint)
            completed.append(action_id)
            completed_ids.add(action_id)
            logger.info(f"Action completed: {action_id} ({action.get('action_type')})")
        except Exception as e:
            failed.append(action_id)
            logger.error(f"Action {action_id} failed: {e}")

    return {
        "completed_actions": completed,
        "failed_actions":    failed,
        "pending_approval":  None,
        "approval_granted":  None,
        "workflow_status":   "running",
    }


async def _dispatch_tool(action: Dict, tool_hint: str):
    """
    Route an ActionItem to the appropriate MCP tool based on tool_hint.
    In production this calls the MCP tool registry.
    """
    action_type = action.get("action_type", "")
    payload     = action.get("payload", {})

    if tool_hint == "slack":
        # await mcp_slack.post_message(**payload)
        logger.info(f"[SLACK] → {payload.get('channel')} : {payload.get('message', '')[:100]}")

    elif tool_hint == "pagerduty":
        # await mcp_pagerduty.trigger_alert(**payload)
        logger.info(f"[PAGERDUTY] severity={payload.get('severity')} : {payload.get('summary')}")

    elif tool_hint == "email":
        # await mcp_email.send(**payload)
        logger.info(f"[EMAIL] → {payload.get('recipient')} : {payload.get('subject')}")

    elif tool_hint == "infra-graph-api":
        # Additional API calls as needed
        logger.info(f"[INFRA-API] {action_type} : {json.dumps(payload)[:200]}")

    elif tool_hint == "status-board":
        logger.info(f"[STATUS-BOARD] {payload.get('site_name')} → {payload.get('status')}")

    else:
        logger.info(f"[UNKNOWN TOOL: {tool_hint}] {action_type} : {json.dumps(payload)[:200]}")


async def generate_summary(state: WorkflowState) -> Dict:
    """
    Node 4: Generate a human-readable operational brief using the LLM.
    """
    analysis = state.get("analysis_result") or {}
    risk_summary = analysis.get("risk_summary", "No analysis available.")
    completed_count = len(state.get("completed_actions", []))
    failed_count    = len(state.get("failed_actions", []))

    trace = langfuse.trace(name="generate_summary", id=state["task_id"])
    span  = trace.span(name="summary_llm")

    try:
        response = await llm.ainvoke([
            SystemMessage(content=SUMMARY_SYSTEM),
            HumanMessage(content=(
                f"Risk analysis:\n{risk_summary}\n\n"
                f"Actions taken: {completed_count} completed, {failed_count} failed.\n"
                f"Resolved sites: {', '.join(state.get('resolved_sites', []))}\n"
                f"Escalation level: {state.get('escalation_level', 0)}"
            )),
        ])
        summary = response.content
        span.end(output=summary)
    except Exception as e:
        summary = risk_summary
        span.end(level="ERROR", status_message=str(e))

    return {
        "final_summary":   summary,
        "workflow_status": "completed",
        "messages": [AIMessage(content=summary)],
    }


async def route_elsewhere(state: WorkflowState) -> Dict:
    """Node: Report is not infrastructure-relevant — log and exit."""
    return {
        "final_summary":   f"Report classified as '{state.get('report_category')}' — not infrastructure-relevant. No action taken.",
        "workflow_status": "completed",
        "messages": [AIMessage(content="Report routed: not infrastructure-relevant.")],
    }


# ---------------------------------------------------------------------------
# Routing functions
# ---------------------------------------------------------------------------

def should_analyze(state: WorkflowState) -> Literal["resolve_and_analyze", "route_elsewhere"]:
    if state.get("is_relevant") and state.get("confidence_score", 0) >= 0.4:
        return "resolve_and_analyze"
    return "route_elsewhere"

def after_analysis(state: WorkflowState) -> Literal["execute_actions", "generate_summary"]:
    if state.get("workflow_status") == "failed":
        return "generate_summary"
    if state.get("action_queue"):
        return "execute_actions"
    return "generate_summary"

def after_execution(state: WorkflowState) -> Literal["execute_actions", "generate_summary"]:
    if state.get("workflow_status") == "awaiting_approval":
        return "execute_actions"  # LangGraph will pause here via interrupt
    # Check if there are still pending (incomplete) actions
    completed_ids = set(state.get("completed_actions", []))
    pending = [a for a in state.get("action_queue", []) if a.get("action_id") not in completed_ids
               and not a.get("requires_approval")]
    if pending:
        return "execute_actions"
    return "generate_summary"


# ---------------------------------------------------------------------------
# Build the graph
# ---------------------------------------------------------------------------

def build_workflow_graph() -> StateGraph:
    graph = StateGraph(WorkflowState)

    graph.add_node("classify_report",     classify_report)
    graph.add_node("resolve_and_analyze", resolve_and_analyze)
    graph.add_node("execute_actions",     execute_actions)
    graph.add_node("generate_summary",    generate_summary)
    graph.add_node("route_elsewhere",     route_elsewhere)

    graph.add_edge(START, "classify_report")
    graph.add_conditional_edges("classify_report", should_analyze)
    graph.add_conditional_edges("resolve_and_analyze", after_analysis)
    graph.add_conditional_edges("execute_actions", after_execution)
    graph.add_edge("generate_summary", END)
    graph.add_edge("route_elsewhere",  END)

    return graph


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

async def run_workflow(
    report_text: str = None,
    site_names: List[str] = None,
    trigger_type: str = "report",
    thread_id: str = None,
    db_url: str = None,
) -> Dict[str, Any]:
    """
    Execute the full infrastructure analysis workflow.

    Args:
        report_text:  Raw report text to classify and analyze
        site_names:   Pre-identified site names (skips classification)
        trigger_type: 'report' | 'alert' | 'manual' | 'schedule'
        thread_id:    Conversation thread ID for PostgreSQL checkpointing
        db_url:       PostgreSQL connection string for checkpoint persistence

    Returns:
        Final WorkflowState dict
    """
    import uuid
    task_id   = str(uuid.uuid4())
    thread_id = thread_id or task_id

    langfuse_handler = CallbackHandler(
        public_key=os.getenv("LANGFUSE_PUBLIC_KEY", ""),
        secret_key=os.getenv("LANGFUSE_SECRET_KEY", ""),
        host=LANGFUSE_HOST,
        trace_name=f"infra-workflow-{trigger_type}",
        session_id=thread_id,
    )

    initial_state: WorkflowState = {
        "messages":           [HumanMessage(content=report_text or f"Analyze sites: {site_names}")],
        "task_id":            task_id,
        "task_description":   report_text or f"Analyze {site_names}",
        "report_text":        report_text,
        "trigger_type":       trigger_type,
        "report_category":    None,
        "is_relevant":        bool(site_names),   # skip classify if sites already known
        "confidence_score":   1.0 if site_names else 0.0,
        "resolved_sites":     site_names or [],
        "resolved_facilities": [],
        "analysis_result":    None,
        "escalation_level":   0,
        "has_viable_backup":  True,
        "action_queue":       [],
        "completed_actions":  [],
        "failed_actions":     [],
        "pending_approval":   None,
        "approval_granted":   None,
        "final_summary":      None,
        "workflow_status":    "running",
    }

    graph = build_workflow_graph()

    # With PostgreSQL checkpointer
    if db_url:
        async with await AsyncPostgresSaver.from_conn_string(db_url) as checkpointer:
            await checkpointer.setup()
            compiled = graph.compile(checkpointer=checkpointer, interrupt_before=["execute_actions"])
            config = {
                "configurable": {"thread_id": thread_id},
                "callbacks": [langfuse_handler],
            }
            result = await compiled.ainvoke(initial_state, config=config)
    else:
        compiled = graph.compile()
        result = await compiled.ainvoke(initial_state, config={"callbacks": [langfuse_handler]})

    langfuse_handler.flush()
    return result


async def resume_workflow_after_approval(
    thread_id: str,
    approved: bool,
    db_url: str,
):
    """Resume a paused workflow after human approval/rejection."""
    graph = build_workflow_graph()
    async with await AsyncPostgresSaver.from_conn_string(db_url) as checkpointer:
        compiled = graph.compile(checkpointer=checkpointer, interrupt_before=["execute_actions"])
        config = {"configurable": {"thread_id": thread_id}}
        # Inject approval decision
        await compiled.aupdate_state(
            config,
            {"approval_granted": approved, "workflow_status": "running"},
        )
        result = await compiled.ainvoke(None, config=config)
    return result
