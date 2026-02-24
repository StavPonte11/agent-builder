# Skills & Evaluation Framework

This package is a standalone module designed to manage, execute, and evaluate AI skills and templates. It has been extracted from the `agent-builder` to function independently.

## Architecture

The framework provides:
- **`executor.py`**: A standalone `SkillExecutor` that executes LLM chains by injecting `Template` data into `Skill` prompts.
- **`evaluator/`**: Implementations of LLM-as-a-judge evaluation techniques:
  - `direct_scoring.py`: Uses a Chain-of-Thought approach to score structured outputs against predefined criteria on a 1-5 scale.
  - `pairwise_comparison.py`: Compares two outputs (e.g. from two different models/prompts) and automatically swaps them to mitigate position bias, returning a confidence score.
- **`datasets/`**: JSON files containing dummy inputs and expected outputs.
- **`experiments/`**: Runners that batch execute skills on datasets and feed outputs into evaluators.

## Getting Started

1. Ensure you have the required dependencies (Pydantic, LangChain, OpenAI) via the monorepo's backend environment.
2. Provide an `OPENAI_API_KEY` either via `.env` or system environment.

### Running the Demo Experiment

To run an evaluation over the basic test cases:

```bash
python experiments/run_demo_experiment.py
```

This will run the dataset through the Executor and evaluate extraction accuracy against the rubric, generating `demo_report.json`.

## Integration

The framework is used within the Monorepo:
- Backend routers (`routers/structuring.py` and `routers/execution.py`) import `SkillExecutor` directly to decouple business logic from the HTTP layer.
- Frontend components such as `SkillManager.tsx` consume the unified backend API to read and manage templates.

