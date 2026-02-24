import asyncio
import os
from temporalio.client import Client
from temporalio.worker import Worker
from temporal_workflows import AgentExecutionWorkflow, fetch_blueprint_activity, execute_graph_activity
from exercise_workflows import (
    ExerciseWorkflow,
    create_exercise_activity,
    tick_simulation_activity,
    run_scenario_generator_activity,
    run_director_activity,
    finalize_exercise_activity,
    _inject_custom_event_activity,
    _override_unit_activity,
)
from database import init_db

import dotenv
dotenv.load_dotenv()

async def run_worker():
    # 1. Ensure DB is initialized (for worker access)
    # await init_db()

    # 2. Connect to Temporal
    temporal_host = os.getenv("TEMPORAL_HOST", "localhost:7233")
    client = await Client.connect(temporal_host)

    # 3. Create Worker — handles both agent execution and exercise workflows
    worker = Worker(
        client,
        task_queue="agent-execution-queue",
        workflows=[AgentExecutionWorkflow, ExerciseWorkflow],
        activities=[
            # Agent execution
            fetch_blueprint_activity,
            execute_graph_activity,
            # Exercise lifecycle
            create_exercise_activity,
            tick_simulation_activity,
            run_scenario_generator_activity,
            run_director_activity,
            finalize_exercise_activity,
            _inject_custom_event_activity,
            _override_unit_activity,
        ]
    )

    print(f"Worker started. Listening on 'agent-execution-queue' at {temporal_host}")
    await worker.run()


if __name__ == "__main__":
    import sys
    import selectors
    
    if sys.platform == 'win32':
        # Psycopg 3 requires SelectorEventLoop on Windows for async operations
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    asyncio.run(run_worker())
