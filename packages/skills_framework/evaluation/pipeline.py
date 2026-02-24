from typing import List, Dict, Any
from .metrics import EvaluationMetrics
from langfuse import Langfuse
import json

class OfflineEvaluator:
    """
    Run comprehensive offline evaluation.
    """
    
    def __init__(self, langfuse_client: Langfuse = None):
        self.langfuse = langfuse_client or Langfuse()
        self.metrics = EvaluationMetrics()
        
    async def evaluate_full_pipeline(
        self,
        test_dataset_name: str,
        agent  # CompiledGraph
    ) -> dict:
        """
        Run agent on test set and calculate all metrics via Langfuse.
        """
        # 1. Fetch dataset from Langfuse
        dataset = self.langfuse.get_dataset(test_dataset_name)
        
        predictions = []
        ground_truths = []
        routing_preds = []
        routing_gts = []
        
        # 2. Run Evaluation
        for item in dataset.items:
            # Execute Agent
            # For testing, we mock the input state
            state = {
                "message": item.input["text"],
                "user_id": "eval_test_user",
                "group_id": "eval_test_group",
                "session_id": "eval_test_session"
            }
            
            # Wrap execution in Langfuse Trace
            trace = self.langfuse.trace(
                name="offline_eval_run",
                metadata={"dataset_item_id": item.id}
            )
            
            # Simulate Graph Execution
            final_state = await agent.ainvoke(state, config={"callbacks": [trace.get_langchain_handler()]})
            
            p_output = final_state.get("final_output", {})
            g_output = item.expected_output
            
            predictions.append(p_output)
            ground_truths.append(g_output)
            
            r_pred = final_state.get("selected_template", {}).get("template_id")
            routing_preds.append(r_pred)
            routing_gts.append(item.metadata.get("target_template"))
            
            # Link output to dataset item in Langfuse
            item.link(trace, "eval_run")
            
        # 3. Calculate Metrics
        routing_results = self.metrics.template_routing_accuracy(routing_preds, routing_gts)
        extraction_results = self.metrics.field_extraction_metrics(predictions, ground_truths)
        end_to_end = self.metrics.end_to_end_success_rate(predictions, ground_truths)
        
        summary = {
            "routing_accuracy": routing_results,
            "extraction_metrics": extraction_results,
            "end_to_end": end_to_end
        }
        
        return summary
    
    async def evaluate_component(
        self,
        component_name: str,
        test_data: List[dict]
    ) -> dict:
        """
        Evaluate individual components in isolation.
        """
        pass
    
    def generate_error_analysis(
        self,
        predictions: List[dict],
        ground_truth: List[dict]
    ) -> dict:
        """
        Categorize and analyze errors.
        """
        return {
            "error_categories": {},
            "examples_per_category": [],
            "suggested_fixes": []
        }
    
    def ablation_study(
        self,
        test_dataset: List[dict]
    ) -> dict:
        """
        Test impact of each component.
        """
        pass
    
    async def run_nightly_benchmark(self):
        """
        Automated nightly evaluation.
        """
        print("Running nightly benchmark against comprehensive_incident_reports...")
        # summary = await self.evaluate_full_pipeline("comprehensive_incident_reports", my_agent)
        # Alert if summary drops below baseline.
        pass
