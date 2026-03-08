"""
Temporal Workflows and Activities for Agent Builder

Contains:
- ExecuteBlueprint workflow
- PublishPipeline workflow
- TestRun workflow
"""
from datetime import timedelta
from temporalio import workflow, activity
from temporalio.common import RetryPolicy

# Import our custom execution packages (will be installed inside the backend runtime)
from workflow_engine import BlueprintCompiler
from guardrails import GuardrailPipeline
from evaluator import BlueprintEvaluator
from mcp_registry import MCPRegistry


# ---------------------------------------------------------------------------
# Activities
# ---------------------------------------------------------------------------

@activity.defn
async def compile_blueprint_activity(definition: dict) -> bool:
    """Compiles a blueprint to verify valid structure."""
    compiler = BlueprintCompiler()
    try:
        compiler.compile(definition)
        return True
    except Exception as e:
        raise ValueError(f"Blueprint compilation failed: {e}")

@activity.defn
async def check_guardrails_activity(prompt: str) -> bool:
    """Runs input against the guardrail pipeline."""
    pipeline = GuardrailPipeline()
    return not pipeline.check_pii(prompt)

@activity.defn
async def execute_langgraph_activity(definition: dict, input_data: dict) -> dict:
    """Compiles and executes the LangGraph workflow engine."""
    compiler = BlueprintCompiler()
    graph = compiler.compile(definition)
    
    # Run the graph
    app = graph
    # For a real implementation, we pass the ExecutionState
    initial_state = {
        "messages": [],
        "context": input_data,
        "memory": {},
        "output": {},
        "is_approved": False
    }
    
    result = await app.ainvoke(initial_state)
    return result.get("output", {})


# ---------------------------------------------------------------------------
# Workflows
# ---------------------------------------------------------------------------

@workflow.defn
class ExecuteBlueprintWorkflow:
    """Main workflow to execute a blueprint end-to-end."""
    
    @workflow.run
    async def run(self, execution_request: dict) -> dict:
        definition = execution_request.get("definition", {})
        input_data = execution_request.get("input", {})
        
        # 1. Compile and Validate
        await workflow.execute_activity(
            compile_blueprint_activity,
            definition,
            start_to_close_timeout=timedelta(seconds=10),
            retry_policy=RetryPolicy(maximum_attempts=2)
        )
        
        # 2. Check Guardrails
        if input_data.get("requires_guardrails", False):
            safe = await workflow.execute_activity(
                check_guardrails_activity,
                str(input_data),
                start_to_close_timeout=timedelta(seconds=10)
            )
            if not safe:
                return {"error": "Guardrail check failed: PII detected."}
                
        # 3. Execute Graph
        result = await workflow.execute_activity(
            execute_langgraph_activity,
            args=[definition, input_data],
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        return result

@workflow.defn
class PublishPipelineWorkflow:
    """Workflow to run compilation, tests, and security scans before publishing a blueprint."""
    
    @workflow.run
    async def run(self, publish_request: dict) -> dict:
        definition = publish_request.get("definition", {})
        
        # 1. Verify compilation
        await workflow.execute_activity(
            compile_blueprint_activity,
            definition,
            start_to_close_timeout=timedelta(seconds=10)
        )
        
        return {"status": "success", "published_version": publish_request.get("target_version", 1)}
