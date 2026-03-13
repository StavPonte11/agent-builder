import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from pydantic import BaseModel, Field
from app.services.llm_provider_pool import LLMProviderPool
import json

class MetricScore(BaseModel):
    score: float = Field(ge=0.0, le=1.0)
    reasoning: str

class EvaluationResult(BaseModel):
    factual_accuracy: MetricScore
    completeness: MetricScore
    overall_pass: bool

async def fetch_real_data(url: str) -> str:
    """Simulate a real web scraper / PDF extraction tool."""
    print(f"[*] Fetching real data from {url}...")
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        # Just return the first 2000 chars for the agent to process
        return response.text[:2000]

async def run_agent(text_content: str, llm_pool: LLMProviderPool) -> str:
    """Simulate the Financial Researcher Agent."""
    print("[*] Running Financial Researcher Agent...")
    system_prompt = "You are a senior financial analyst. Summarize the following text, highlighting any key financial metrics, company names, or risk factors."
    
    # We use a fast model for the agent
    response = llm_pool.call(
        model="gpt-3.5-turbo", # Will fallback to whatever is available in pool
        system=system_prompt,
        user=f"Context Document:\n\n{text_content}",
        temperature=0.2
    )
    return response

async def evaluate_output(agent_output: str, source_text: str, llm_pool: LLMProviderPool) -> EvaluationResult:
    """Use LLM-as-a-judge to evaluate the quality based on a rubric."""
    print("[*] Running LLM-as-a-Judge Evaluation...")
    
    judge_prompt = """
    You are an impartial expert evaluator scoring an AI agent's performance.
    
    RUBRIC:
    1. Factual Accuracy (0.0 to 1.0): Does the agent's summary ONLY contain facts present in the source text? Penalize hallucinations heavily.
    2. Completeness (0.0 to 1.0): Did the agent capture the most important financial entities, metrics, and risks from the source text?
    
    Respond STRICTLY in JSON matching this schema:
    {
      "factual_accuracy": {"score": 0.9, "reasoning": "..."},
      "completeness": {"score": 0.8, "reasoning": "..."},
      "overall_pass": true
    }
    """
    
    # We use a smarter model for the judge
    response = llm_pool.call(
        model="gpt-4", # Will fallback to best available
        system=judge_prompt,
        user=f"SOURCE TEXT:\n{source_text}\n\nAGENT OUTPUT:\n{agent_output}",
        temperature=0.0
    )
    
    # Clean possible markdown formatting
    clean_json = response.replace('```json', '').replace('```', '').strip()
    data = json.loads(clean_json)
    return EvaluationResult(**data)

async def main():
    print("=== Agent Builder Evaluation Framework ===\n")
    
    # Initialize our backend services
    llm_pool = LLMProviderPool()
    
    # Test Set
    test_url = "https://raw.githubusercontent.com/FreekBes/nvidia-10k/main/10-K.txt" # Raw text of an SEC 10-K filing or similar simple test
    # Fallback to a placeholder if the URL above is down
    fallback_text = "Acme Corp reported Q3 revenues of $5.2 billion, up 12% year-over-year. Operating margin decreased to 18% due to supply chain constraints. Key risks include rising inflation and potential semiconductor shortages."
    
    try:
        source_text = await fetch_real_data(test_url)
    except Exception:
        print("[!] Failed to fetch real URL, using fallback test data.")
        source_text = fallback_text

    # 1. Run the agent
    agent_output = await run_agent(source_text, llm_pool)
    print("\n--- Agent Output ---")
    print(agent_output)
    print("--------------------\n")
    
    # 2. Evaluate
    eval_result = await evaluate_output(agent_output, source_text, llm_pool)
    
    # 3. Report
    print("=== Evaluation Results ===")
    print(f"Factual Accuracy : {eval_result.factual_accuracy.score:.2f} - {eval_result.factual_accuracy.reasoning}")
    print(f"Completeness     : {eval_result.completeness.score:.2f} - {eval_result.completeness.reasoning}")
    print(f"Overall Pass     : {'✅ YES' if eval_result.overall_pass else '❌ NO'}")

if __name__ == "__main__":
    # Note: Requires OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY in environment
    asyncio.run(main())
