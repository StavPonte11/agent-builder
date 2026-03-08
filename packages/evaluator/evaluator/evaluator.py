"""
Blueprint Evaluator implementation using Langfuse.
"""
import uuid
from langfuse import Langfuse
from langfuse.model import CreateSpan

class BlueprintEvaluator:
    def __init__(self, public_key: str | None = None, secret_key: str | None = None, host: str | None = None):
        # By default this will check ENV variables for LANGFUSE_PUBLIC_KEY, etc.
        if public_key and secret_key:
            self.langfuse = Langfuse(public_key, secret_key, host)
        else:
            self.langfuse = Langfuse()

    def start_execution_trace(self, blueprint_id: uuid.UUID, execution_id: uuid.UUID, input_data: dict) -> str:
        """Starts a full trace for a blueprint execution."""
        trace = self.langfuse.trace(
            id=str(execution_id),
            name=f"blueprint-{blueprint_id}",
            input=input_data,
            tags=[f"blueprint:{blueprint_id}"]
        )
        return trace.id

    def log_node_execution(self, trace_id: str, node_id: str, node_type: str, input_state: dict):
        """Creates a span for a single node inside an execution trace."""
        self.langfuse.span(
            trace_id=trace_id,
            name=f"node-{node_type}-{node_id}",
            input=input_state,
        )

    def log_node_completion(self, trace_id: str, node_id: str, node_type: str, output_state: dict):
        """Updates the span on completion."""
        # Note: In true usage, langfuse returns a span object that you can call .end() on.
        # This wrapper provides high-level metric gathering.
        pass
    
    def flush(self):
        self.langfuse.flush()
