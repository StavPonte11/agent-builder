from typing import TypedDict, List, Optional, Any, Literal
from langgraph.graph import StateGraph, END

# Import our custom systems
from .registry import TemplateRegistry
from .nlp import HebrewNLPProcessor
from .routing import TemplateRouter
from .extractor import FieldExtractor
from .geo import GeoResolver
from .validation import ValidationEngine
from .memory import MemoryManager

class MessageStructuringState(TypedDict):
    # Input
    message: str
    user_id: str
    group_id: str
    session_id: str
    
    # Context
    session_context: Optional[dict]
    user_context: Optional[dict]
    group_context: Optional[dict]
    
    # Routing
    template_candidates: List[dict]
    selected_template: Optional[dict]
    routing_confidence: float
    
    # Extraction
    extracted_entities: dict
    extracted_fields: dict
    field_confidences: dict
    citations: dict
    
    # Validation
    validation_result: dict
    overall_confidence: float
    
    # Human-in-the-loop
    requires_clarification: bool
    clarification_questions: List[dict]
    user_responses: Optional[dict]
    
    # Output
    final_output: Optional[dict]
    metadata: dict


def build_agent(
    postgres_checkpointer=None,
    llm=None,
    embedder=None
):
    """
    Constructs the LangGraph-based orchestration agent.
    """
    # Initialize components
    registry = TemplateRegistry()
    nlp = HebrewNLPProcessor()
    router = TemplateRouter(registry, embedder, llm)
    extractor = FieldExtractor(llm, nlp)
    geo_resolver = GeoResolver(nlp_processor=nlp)
    validator = ValidationEngine()
    memory = MemoryManager(postgres_checkpointer)

    # Node definitions
    async def load_context_node(state: MessageStructuringState):
        ctx = await memory.assemble_full_context(
            state["session_id"], state["user_id"], state["group_id"]
        )
        return {
            "session_context": ctx["session"],
            "user_context": ctx["user"],
            "group_context": ctx["group"]
        }

    async def route_template_node(state: MessageStructuringState):
        candidates = await router.route(state["message"], state["group_id"], state["user_context"])
        disambiguated = await router.disambiguate(state["message"], candidates)
        
        selected = disambiguated.get("selected_template") if disambiguated else None
        conf = candidates[0]["confidence_score"] if candidates else 0.0
        
        return {
            "template_candidates": candidates,
            "selected_template": selected,
            "routing_confidence": conf
        }

    async def extract_entities_node(state: MessageStructuringState):
        if not state.get("selected_template"):
            return {"extracted_entities": {}}
        ents = await nlp.extract_entities(
            state["message"], 
            state["selected_template"].get("schema", {})
        )
        return {"extracted_entities": ents}

    async def extract_fields_node(state: MessageStructuringState):
        if not state.get("selected_template"):
            return {"extracted_fields": {}}
            
        fields = await extractor.extract_fields(
            state["message"],
            state["selected_template"].get("schema", {}),
            state.get("session_context")
        )
        return {"extracted_fields": fields}

    async def resolve_geo_node(state: MessageStructuringState):
        fields = state.get("extracted_fields", {}).copy()
        schema = state.get("selected_template", {}).get("schema", {})
        
        # Check if any field needs geo resolution based on schema
        if "properties" in schema:
            for field_name, t in schema["properties"].items():
                if geo_resolver.requires_polygon(t) or t.get("type") == "location":
                    # resolve
                    res = await geo_resolver.extract_and_resolve(state["message"], t)
                    if "error" not in res:
                        fields[field_name] = res
        
        return {"extracted_fields": fields}

    async def validate_node(state: MessageStructuringState):
        template = state.get("selected_template")
        if not template:
            return {"validation_result": {"is_valid": False}, "overall_confidence": 0}
            
        res = await validator.validate(
            state.get("extracted_fields", {}),
            template.get("schema", {})
        )
        conf = validator.calculate_overall_confidence(state.get("extracted_fields", {}))
        
        needs_clarification = not validator.should_auto_approve(conf, res)
        
        return {
            "validation_result": res,
            "overall_confidence": conf,
            "requires_clarification": needs_clarification
        }

    async def generate_clarification_node(state: MessageStructuringState):
        questions = await validator.generate_clarification_questions(
            state["validation_result"],
            state["extracted_fields"],
            state["message"]
        )
        return {"clarification_questions": questions}

    async def await_user_response_node(state: MessageStructuringState):
        # This node gets interrupted before running due to graph configuration
        # When resumed, the state should contain user_responses
        if state.get("user_responses"):
            updated = await validator.incorporate_user_response(
                state.get("extracted_fields", {}),
                state["user_responses"]
            )
            return {"extracted_fields": updated, "user_responses": None, "requires_clarification": False}
        return {}

    async def finalize_node(state: MessageStructuringState):
        output = {}
        for k, v in state.get("extracted_fields", {}).items():
            if isinstance(v, dict):
                output[k] = v.get("value", v)
            else:
                output[k] = v
                
        return {"final_output": output, "metadata": {"confidence": state.get("overall_confidence")}}

    async def learn_node(state: MessageStructuringState):
        if state.get("user_responses"):
            # Update memory because human had to correct something
            await memory.learn_from_correction(
                state["user_id"],
                {}, # old
                state["extracted_fields"]
            )
        return {}

    # Build the StateGraph
    workflow = StateGraph(MessageStructuringState)
    
    workflow.add_node("load_context", load_context_node)
    workflow.add_node("route_template", route_template_node)
    workflow.add_node("extract_entities", extract_entities_node)
    workflow.add_node("extract_fields", extract_fields_node)
    workflow.add_node("resolve_geo", resolve_geo_node)
    workflow.add_node("validate", validate_node)
    workflow.add_node("generate_clarification", generate_clarification_node)
    workflow.add_node("await_user", await_user_response_node)
    workflow.add_node("finalize", finalize_node)
    workflow.add_node("learn", learn_node)
    
    # Edges
    workflow.set_entry_point("load_context")
    workflow.add_edge("load_context", "route_template")
    
    # Conditional logic based on routing
    def route_after_template(state: MessageStructuringState) -> Literal["extract_entities", "generate_clarification"]:
        if not state.get("selected_template"):
            return "generate_clarification"
        return "extract_entities"
        
    workflow.add_conditional_edges("route_template", route_after_template)
    
    workflow.add_edge("extract_entities", "extract_fields")
    workflow.add_edge("extract_fields", "resolve_geo")
    workflow.add_edge("resolve_geo", "validate")
    
    # Conditional logic based on validation
    def route_after_validation(state: MessageStructuringState) -> Literal["generate_clarification", "learn"]:
        if state.get("requires_clarification"):
            return "generate_clarification"
        return "learn"
        
    workflow.add_conditional_edges("validate", route_after_validation)
    
    workflow.add_edge("generate_clarification", "await_user")
    
    # After user responds, re-validate
    workflow.add_edge("await_user", "validate")
    
    workflow.add_edge("learn", "finalize")
    workflow.add_edge("finalize", END)
    
    # Compile with human-in-the-loop interrupt
    return workflow.compile(
        checkpointer=postgres_checkpointer,
        interrupt_before=["await_user"]
    )
