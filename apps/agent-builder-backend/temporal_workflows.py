from datetime import timedelta
from typing import Dict, Any, Optional
from temporalio import workflow, activity
from temporalio.common import RetryPolicy
from uuid import UUID

# Import types - use string forward references to avoid circular imports if classes aren't available here
# Activities running in worker need access to DB, but Workflow definitions must be pure.

@activity.defn
async def fetch_blueprint_activity(blueprint_id: str) -> Dict[str, Any]:
    # This runs in the Worker process, which has DB access
    from database import get_session
    from crud import CRUDBlueprint
    from uuid import UUID
    
    async for session in get_session():
        bp = await CRUDBlueprint.get(session, UUID(blueprint_id))
        if not bp:
            raise ValueError(f"Blueprint {blueprint_id} not found")
        
        # Serialize for transport
        return {
            "id": str(bp.id),
            "blueprint_data": bp.blueprint_data,
            "entry_point": bp.blueprint_data.get("entry_point", "reasoning") # default or get from schema
        }
    return {}

@activity.defn
async def execute_graph_activity(blueprint_data: Dict[str, Any], input_data: Dict[str, Any], thread_id: str) -> Dict[str, Any]:
    # This runs in the worker
    from graph_factory import GraphFactory
    from graph_cache import GraphCache
    from database import get_checkpointer
    from blueprint_schema import BlueprintSchema
    from uuid import UUID
    
    blueprint_id = UUID(blueprint_data["id"])
    
    # 1. Get/Compile Graph
    # app = GraphCache.get(blueprint_id)
    # if not app:
    checkpointer = await get_checkpointer()
    factory = GraphFactory()
    schema = BlueprintSchema(**blueprint_data["blueprint_data"])
    app = await factory.compile(schema, checkpointer)
    # GraphCache.set(blueprint_id, app) # Caching with async checkpointer is tricky, simple recompilation is safer for now
    
    # 2. Execute
    config = {"configurable": {"thread_id": thread_id}}
    
    # We use ainvoke to run the graph
    # LangGraph returns the final state
    result = await app.ainvoke(input_data, config)
    
    # 3. Extract output (simplistic for now)
    messages = result.get("messages", [])
    last_message = messages[-1] if messages else None
    output_content = last_message.content if last_message else "No response"
    
    return {"output": output_content, "full_state": str(result)}


@workflow.defn
class AgentExecutionWorkflow:
    @workflow.run
    async def run(self, blueprint_id: str, input_data: Dict[str, Any], user_id: str, thread_id: str) -> Dict[str, Any]:
        
        # 1. Fetch Blueprint
        blueprint = await workflow.execute_activity(
            fetch_blueprint_activity,
            blueprint_id,
            start_to_close_timeout=timedelta(seconds=10),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        # 2. Execute Graph (this could be long running)
        result = await workflow.execute_activity(
            execute_graph_activity,
            args=[blueprint, input_data, thread_id],
            start_to_close_timeout=timedelta(minutes=5), # Adjust based on max execution time
             retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        return result
