"""
Temporal worker entry point.
Registers all workflows and activities on the configured task queues.
Run with: uv run python -m app.temporal.worker
"""
from __future__ import annotations

import asyncio
import logging

import structlog
from temporalio.client import Client
from temporalio.worker import Worker

from app.config import settings

logger = structlog.get_logger()


async def run_worker() -> None:
    """Start the Temporal worker."""
    # Import workflows and activities (lazy to avoid circular imports)
    from app.temporal.workflows.execute_blueprint import ExecuteBlueprintWorkflow
    from app.temporal.workflows.publish_pipeline import PublishPipelineWorkflow
    from app.temporal.workflows.run_tests import TestRunWorkflow
    from app.temporal.activities.llm_activities import run_llm_node
    from app.temporal.activities.tool_activities import run_tool_node
    from app.temporal.activities.guardrail_activities import (
        check_input_guardrails,
        check_output_guardrails,
        check_node_pre_guardrails,
        check_node_post_guardrails,
    )
    from app.temporal.activities.evaluation_activities import evaluate_test_output
    from app.temporal.activities.notification_activities import send_execution_event

    client = await Client.connect(settings.TEMPORAL_HOST, namespace=settings.TEMPORAL_NAMESPACE)
    logger.info("temporal.worker.connected", host=settings.TEMPORAL_HOST)

    worker = Worker(
        client,
        task_queue=settings.TEMPORAL_TASK_QUEUE_EXECUTION,
        workflows=[
            ExecuteBlueprintWorkflow,
            PublishPipelineWorkflow,
            TestRunWorkflow,
        ],
        activities=[
            run_llm_node,
            run_tool_node,
            check_input_guardrails,
            check_output_guardrails,
            check_node_pre_guardrails,
            check_node_post_guardrails,
            evaluate_test_output,
            send_execution_event,
        ],
    )

    logger.info("temporal.worker.starting", task_queue=settings.TEMPORAL_TASK_QUEUE_EXECUTION)
    await worker.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker())
