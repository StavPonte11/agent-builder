from typing import List, Dict, Any
from collections import defaultdict

class EvaluationMetrics:
    """
    Calculate performance metrics across all dimensions.
    """
    
    def template_routing_accuracy(
        self,
        predictions: List[str],
        ground_truth: List[str]
    ) -> dict:
        """
        Calculate Top-1 routing accuracy.
        """
        if not predictions or not ground_truth:
            return {"top1_accuracy": 0.0}
            
        correct = sum([1 for p, g in zip(predictions, ground_truth) if p == g])
        acc = correct / len(predictions)
        return {"top1_accuracy": acc}
    
    def field_extraction_metrics(
        self,
        predictions: List[dict],
        ground_truth: List[dict],
        per_field: bool = True
    ) -> dict:
        """
        Calculate Precision, Recall, F1 for field extraction.
        """
        tp = 0
        fp = 0
        fn = 0
        
        field_stats = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
        exact_matches = 0
        
        for p_row, g_row in zip(predictions, ground_truth):
            msg_exact = True
            all_fields = set(p_row.keys()).union(set(g_row.keys()))
            for field in all_fields:
                p_val = p_row.get(field)
                g_val = g_row.get(field)
                
                if p_val == g_val and g_val is not None:
                    tp += 1
                    field_stats[field]["tp"] += 1
                elif p_val is not None and g_val is None:
                    fp += 1
                    field_stats[field]["fp"] += 1
                    msg_exact = False
                elif p_val is None and g_val is not None:
                    fn += 1
                    field_stats[field]["fn"] += 1
                    msg_exact = False
                elif p_val != g_val:
                    # Incorrect extraction counts as FP + FN
                    fp += 1
                    fn += 1
                    field_stats[field]["fp"] += 1
                    field_stats[field]["fn"] += 1
                    msg_exact = False
                    
            if msg_exact:
                exact_matches += 1
                
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        
        return {
            "overall": {"precision": precision, "recall": recall, "f1": f1},
            "exact_match_ratio": exact_matches / len(predictions) if predictions else 0
        }
    
    def end_to_end_success_rate(
        self,
        predictions: List[dict],
        ground_truth: List[dict]
    ) -> dict:
        """
        % of messages correctly structured without intervention.
        """
        if not predictions:
            return {"zero_shot": 0.0}
            
        successes = 0
        for p, g in zip(predictions, ground_truth):
            # A success is defined here as exact field match for simplicity
            if p == g:
                successes += 1
                
        return {
            "zero_shot": successes / len(predictions)
        }
        
    def hebrew_nlp_accuracy(
        self,
        predictions: List[dict],
        ground_truth: List[dict]
    ) -> dict:
        """
        Hebrew-specific metrics like glossary hits.
        """
        # Placeholder for specific term checking
        return {
            "glossary_term_f1": 0.0,
            "location_extraction_f1": 0.0,
            "temporal_extraction_f1": 0.0
        }
