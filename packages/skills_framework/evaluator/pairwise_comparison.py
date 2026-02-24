"""
Pairwise Comparison Evaluation Engine

Based on the `advanced-evaluation` skill:
- Automatically swaps positions to mitigate Position Bias
- Calculates confidence based on consistency
- Used for preference or quality judgment
"""

from pydantic import BaseModel, Field
from typing import List, Literal, Optional
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

class PairwiseComparisonVote(BaseModel):
    winner: Literal["A", "B", "TIE"]
    confidence: float = Field(description="Confidence level 0-1")
    reasoning: str

class PairwiseComparisonResult(BaseModel):
    winner: Literal["A", "B", "TIE"]
    confidence: float
    reasoning: str
    position_consistent: bool

class PairwiseComparisonEvaluator:
    def __init__(self, model_name: str = "gpt-4o"):
        self.llm = ChatOpenAI(model=model_name, temperature=0.0)

    def _compare(self, prompt: str, response_a: str, response_b: str, criteria: List[str]) -> PairwiseComparisonVote:
        system_prompt = """You are an expert evaluator comparing two AI responses.

## Critical Instructions
- Do NOT prefer responses because they are longer
- Do NOT prefer responses based on position (first vs second)
- Focus ONLY on quality according to the specified criteria
- Ties are acceptable when responses are genuinely equivalent

## Comparison Criteria
{criteria_text}

## Instructions
1. Analyze each response independently first
2. Compare them on each criterion
3. Determine overall winner with confidence level
4. Provide reasoning before making your final decision
"""
        user_prompt = """
## Original Prompt
{prompt}

## Response A
{response_a}

## Response B
{response_b}
"""
        prompt_opt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", user_prompt)
        ])
        
        chain = prompt_opt | self.llm.with_structured_output(PairwiseComparisonVote)
        
        criteria_text = "\n".join([f"- {c}" for c in criteria])
        
        return chain.invoke({
            "criteria_text": criteria_text,
            "prompt": prompt,
            "response_a": response_a,
            "response_b": response_b
        })

    def evaluate(self, prompt: str, response_1: str, response_2: str, criteria: List[str]) -> PairwiseComparisonResult:
        # Pass 1: 1=A, 2=B
        vote_1 = self._compare(prompt, response_1, response_2, criteria)
        
        # Pass 2: 2=A, 1=B
        vote_2 = self._compare(prompt, response_2, response_1, criteria)
        
        # Map vote_2 back to original ordering
        mapped_vote_2_winner = "TIE"
        if vote_2.winner == "A":
            mapped_vote_2_winner = "B"
        elif vote_2.winner == "B":
            mapped_vote_2_winner = "A"
            
        is_consistent = vote_1.winner == mapped_vote_2_winner
        
        if is_consistent:
            return PairwiseComparisonResult(
                winner=vote_1.winner,
                confidence=(vote_1.confidence + vote_2.confidence) / 2.0,
                reasoning=f"Consistent. Pass 1: {vote_1.reasoning}\nPass 2: {vote_2.reasoning}",
                position_consistent=True
            )
        else:
            return PairwiseComparisonResult(
                winner="TIE",
                confidence=0.5,
                reasoning=f"Inconsistent. Pass 1 voted for {vote_1.winner}. Pass 2 voted for {mapped_vote_2_winner}. Forcing TIE.",
                position_consistent=False
            )
