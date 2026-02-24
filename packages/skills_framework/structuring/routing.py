from typing import List, Optional, Dict, Any
from .registry import TemplateRegistry

class TemplateRouter:
    """
    Routes messages to the most appropriate template.
    """
    
    def __init__(self, template_registry: TemplateRegistry, embedder=None, llm=None):
        self.registry = template_registry
        self.embedder = embedder # e.g. HuggingFaceEmbeddings
        self.llm = llm # ChatOpenAI or similar
    
    async def route(
        self,
        message: str,
        group_id: str,
        user_context: Optional[dict] = None,
        top_k: int = 3
    ) -> List[dict]:
        """
        Find best matching templates using Embedding similarity + Group filtering.
        """
        # Step 1: Semantic search in vector DB
        candidates = await self.registry.search_templates(query=message, group_id=group_id, top_k=top_k)
        
        # Step 2: Score candidates (mocking the confidence score logic here)
        routed_results = []
        for c in candidates:
            # simple mock logic: exact keyword match gives high confidence
            score = 0.5
            if c.get("name", "").lower() in message.lower():
                score += 0.4
            
            routed_results.append({
                "template_id": c["template_id"],
                "template_name": c["name"],
                "schema": c["schema"],
                "confidence_score": score,
                "reasoning": f"Semantic match score {score}"
            })
            
        # Sort desc
        routed_results.sort(key=lambda x: x["confidence_score"], reverse=True)
        return routed_results
    
    async def disambiguate(
        self,
        message: str,
        candidate_templates: List[dict]
    ) -> dict:
        """
        Use LLM to choose between similar templates gracefully.
        """
        if not candidate_templates:
            return None
            
        if len(candidate_templates) == 1:
            return {"selected_template": candidate_templates[0], "reasoning": "Only one candidate."}
            
        # Mocking LLM decision: Just pick the top one for now
        # In prod: Ask LLM: "Given message X and templates A, B, C, which fits best?"
        best = candidate_templates[0]
        return {
            "selected_template": best,
            "reasoning": f"Selected highest confidence template {best['template_name']}"
        }
    
    def should_request_clarification(
        self,
        routing_result: List[dict],
        confidence_threshold: float = 0.8
    ) -> bool:
        """Determine if human clarification is needed"""
        if not routing_result:
            return True
        top_score = routing_result[0]["confidence_score"]
        return top_score < confidence_threshold
