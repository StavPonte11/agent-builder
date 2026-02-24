"""
Direct Scoring Evaluation Engine

Based on the `advanced-evaluation` skill:
- Requires Chain-of-Thought (justification) before scoring.
- Used for objective criteria (factual accuracy, instruction following, format compliance).
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import os

class ScoringCriterion(BaseModel):
    name: str
    description: str
    weight: float = 1.0
    scale: str = "1-5"

class CriterionScore(BaseModel):
    criterion: str
    evidence: List[str] = Field(description="Specific evidence from the response supporting the score")
    justification: str = Field(description="Reasoning for the score, written before the final score")
    score: int = Field(description="Numeric score based on the rubric")
    improvement: Optional[str] = Field(description="One specific improvement suggestion", default=None)

class DirectScoringResult(BaseModel):
    scores: List[CriterionScore]
    overall_score: float

class DirectScoringEvaluator:
    def __init__(self, model_name: str = "gpt-4o"):
        self.llm = ChatOpenAI(model=model_name, temperature=0.0)
    
    def evaluate(self, prompt: str, response: str, criteria: List[ScoringCriterion]) -> DirectScoringResult:
        criteria_text = "\n".join([f"- {c.name} (Scale: {c.scale}): {c.description}" for c in criteria])
        
        system_prompt = """You are an expert evaluator assessing response quality.

## Task
Evaluate the following response against each criterion.

## Criteria
{criteria_text}

## Instructions
For each criterion:
1. Find specific evidence in the response
2. Write your justification based on the evidence
3. Score according to the rubric
4. Suggest one specific improvement

Respond with structured JSON.
"""

        user_prompt = """
## Original Prompt
{prompt}

## Response to Evaluate
{response}
"""
        
        prompt_opt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", user_prompt)
        ])
        
        chain = prompt_opt | self.llm.with_structured_output(DirectScoringResult)
        
        result = chain.invoke({
            "criteria_text": criteria_text,
            "prompt": prompt,
            "response": response
        })
        
        return result
