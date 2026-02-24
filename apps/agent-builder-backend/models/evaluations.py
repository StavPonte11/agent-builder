from datetime import datetime
from typing import Dict, Any, List, Optional, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

# ============================================================================
# TESTING & EVALUATION
# ============================================================================


class TestCase(BaseModel):
    """Individual test case"""

    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    description: Optional[str] = None
    input_data: Dict[str, Any]
    expected_output: Optional[Dict[str, Any]] = None
    success_criteria: Dict[str, Any] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)


class TestSuite(BaseModel):
    """Collection of test cases"""

    id: str = Field(default_factory=lambda: str(uuid4()))
    build_id: str
    name: str
    test_type: Literal["unit", "integration", "performance", "safety"]
    test_cases: List[TestCase]
    created_at: datetime = Field(default_factory=datetime.now)


class TestResult(BaseModel):
    """Result of a single test execution"""

    test_case_id: str
    passed: bool
    actual_output: Optional[Dict[str, Any]] = None
    expected_output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time: float
    tokens_used: int
    cost: float
    langfuse_trace_id: Optional[str] = None


class EvaluationMetrics(BaseModel):
    """Performance and quality metrics"""

    # Performance
    avg_latency: float
    p50_latency: float
    p95_latency: float
    p99_latency: float
    throughput: float

    # Quality
    success_rate: float
    error_rate: float

    # Cost
    avg_tokens: float
    avg_cost: float
    total_cost: float

    # Safety
    guardrail_violations: int
    pii_detected_count: int


class LLMJudgeScore(BaseModel):
    """LLM-as-a-Judge evaluation scores"""

    criterion: str
    score: float = Field(ge=0.0, le=10.0)
    reasoning: str
    suggestions: List[str] = Field(default_factory=list)


class Evaluation(BaseModel):
    """Complete evaluation result"""

    id: str = Field(default_factory=lambda: str(uuid4()))
    build_id: str
    test_suite_id: str

    # Results
    test_results: List[TestResult]
    metrics: EvaluationMetrics
    llm_judge_scores: List[LLMJudgeScore] = Field(default_factory=list)

    # Pass/fail
    passed: bool
    blocking_issues: List[str] = Field(default_factory=list)

    # Langfuse
    langfuse_dataset_id: Optional[str] = None
    langfuse_experiment_id: Optional[str] = None

    # Metadata
    executed_at: datetime = Field(default_factory=datetime.now)
    executed_by: str
