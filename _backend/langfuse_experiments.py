"""
langfuse_experiments.py — Langfuse Dataset + Experiment runner for police simulation

Usage:
  # Set env vars:
  LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST (optional)
  OPENAI_API_KEY
  REDIS_URL (optional, defaults to localhost)

  # Run a scoring experiment on the last N decisions from an exercise:
  python langfuse_experiments.py --exercise-id ex_001 --n 20

  # Create a dataset from exercise decisions:
  python langfuse_experiments.py --create-dataset --exercise-id ex_001
"""

import asyncio
import json
import os
import argparse
import logging
from datetime import datetime

from langfuse import Langfuse
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── Langfuse Client ────────────────────────────────────────────────

def get_langfuse() -> Langfuse:
    return Langfuse(
        public_key=os.environ["LANGFUSE_PUBLIC_KEY"],
        secret_key=os.environ["LANGFUSE_SECRET_KEY"],
        host=os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com"),
    )


# ── Dataset Management ─────────────────────────────────────────────

async def create_dataset_from_exercise(exercise_id: str, dataset_name: str | None = None):
    """
    Export decisions_log from an exercise to a Langfuse dataset.
    Each decision becomes one dataset item (input + expected metrics).
    """
    from state_store import get_state_store

    store = await get_state_store()
    state = await store.get(exercise_id)
    if not state:
        raise ValueError(f"Exercise {exercise_id} not found in Redis")

    lf = get_langfuse()
    ds_name = dataset_name or f"police_sim_{exercise_id}_{datetime.now().strftime('%Y%m%d_%H%M')}"

    try:
        dataset = lf.get_dataset(ds_name)
        logger.info(f"Using existing dataset: {ds_name}")
    except Exception:
        dataset = lf.create_dataset(
            name=ds_name,
            description=f"Police simulation decisions from exercise {exercise_id}",
            metadata={"exercise_id": exercise_id, "scenario": state.scenario_name},
        )
        logger.info(f"Created dataset: {ds_name}")

    items_created = 0
    for decision in state.decisions_log:
        # Build context snapshot for this decision
        input_data = {
            "decision": decision,
            "exercise_context": {
                "elapsed_minutes": state.elapsed_minutes,
                "active_events": len(state.active_events),
                "unit_count": len(state.unit_statuses),
            },
        }

        # Compute expected output based on ground-truth rules
        high_fatigue_ids = {u.unit_id for u in state.unit_statuses if u.fatigue > 0.85}
        used_units = decision.get("assigned_units", [])
        fatigue_violation = any(uid in high_fatigue_ids for uid in used_units)

        expected_output = {
            "fatigue_compliance": 0.0 if fatigue_violation else 1.0,
            "has_reasoning": 1.0 if decision.get("reasoning") else 0.0,
        }

        lf.create_dataset_item(
            dataset_name=ds_name,
            input=input_data,
            expected_output=expected_output,
            metadata={"decision_id": decision.get("timestamp", "")},
        )
        items_created += 1

    lf.flush()
    logger.info(f"Created {items_created} dataset items in '{ds_name}'")
    return ds_name


# ── Experiment Runner ──────────────────────────────────────────────

async def run_scoring_experiment(
    exercise_id: str,
    n_decisions: int = 20,
    model: str = "gpt-4o-mini",
):
    """
    Run a Langfuse experiment: score the last N decisions from an exercise
    using GPT-4o-mini and emit scores to Langfuse.
    """
    from state_store import get_state_store

    store = await get_state_store()
    state = await store.get(exercise_id)
    if not state:
        raise ValueError(f"Exercise {exercise_id} not found")

    lf = get_langfuse()
    llm = ChatOpenAI(model=model, temperature=0)

    decisions = state.decisions_log[-n_decisions:]
    logger.info(f"Scoring {len(decisions)} decisions from exercise {exercise_id}")

    experiment_scores = []

    for i, decision in enumerate(decisions):
        trace = lf.trace(
            name=f"decision_evaluation",
            user_id="evaluator_agent",
            session_id=exercise_id,
            metadata={
                "exercise_id": exercise_id,
                "decision_index": i,
                "model": model,
            },
            tags=["police_simulation", "evaluation"],
        )

        # ── Fatigue Compliance ─────────────────────────────────────
        high_fatigue_ids = {u.unit_id for u in state.unit_statuses if u.fatigue > 0.85}
        used_units = decision.get("assigned_units", [])
        fatigue_violation = any(uid in high_fatigue_ids for uid in used_units)
        fatigue_score = 0.0 if fatigue_violation else 1.0

        trace.score(name="fatigue_compliance", value=fatigue_score,
                    comment="Rule-based: fatigue > 0.85 on assigned unit = violation")

        # ── Reasoning Quality (LLM-graded) ─────────────────────────
        reasoning = decision.get("reasoning", "")
        if reasoning:
            generation = trace.generation(
                name="reasoning_quality_eval",
                model=model,
                input={"reasoning": reasoning, "decision": decision},
            )
            prompt = f"""Rate the quality of this police dispatch reasoning on a scale of 0.0 to 1.0.

Decision: {json.dumps(decision, default=str)}

Criteria:
- Mentions specific unit names/IDs (0.2)
- Explains WHY this unit was chosen (0.3)
- References fatigue or experience level (0.3)
- Notes estimated arrival time (0.2)

Respond with ONLY a single float number between 0.0 and 1.0."""

            response = await llm.ainvoke([HumanMessage(content=prompt)])
            raw = response.content.strip()
            try:
                quality_score = max(0.0, min(1.0, float(raw)))
            except ValueError:
                quality_score = 0.5

            generation.end(output={"score": quality_score})
            trace.score(name="reasoning_quality", value=quality_score)
        else:
            trace.score(name="reasoning_quality", value=0.0,
                        comment="No reasoning provided")
            quality_score = 0.0

        # ── Safety Score ────────────────────────────────────────────
        priority = decision.get("priority", 3)
        is_critical = priority >= 4
        safety_violation = is_critical and fatigue_violation
        safety_score = 0.0 if safety_violation else 1.0

        trace.score(name="safety", value=safety_score,
                    comment="Critical event assigned to exhausted unit = safety violation")

        # ── Aggregate ───────────────────────────────────────────────
        aggregate = (fatigue_score * 0.35 + quality_score * 0.40 + safety_score * 0.25)
        trace.score(name="overall_quality", value=aggregate)

        experiment_scores.append({
            "fatigue_compliance": fatigue_score,
            "reasoning_quality": quality_score,
            "safety": safety_score,
            "overall_quality": aggregate,
        })

        logger.info(f"Decision {i+1}/{len(decisions)}: overall={aggregate:.2f}")

    lf.flush()

    # Print aggregate summary
    if experiment_scores:
        avg = {
            k: sum(s[k] for s in experiment_scores) / len(experiment_scores)
            for k in experiment_scores[0]
        }
        print("\n── Experiment Summary ──────────────────────────────")
        print(f"Exercise: {exercise_id}")
        print(f"Decisions evaluated: {len(experiment_scores)}")
        for metric, value in avg.items():
            bar = "█" * int(value * 20)
            print(f"  {metric:25s}: {value:.3f} {bar}")
        print("────────────────────────────────────────────────────")
        return avg

    return {}


# ── Comparative Experiment (A/B) ───────────────────────────────────

async def run_ab_experiment(exercise_id_a: str, exercise_id_b: str):
    """
    Compare scoring between two exercise runs (e.g. different scenario configs).
    Useful for A/B testing different blueprint configurations.
    """
    logger.info(f"Running A/B experiment: {exercise_id_a} vs {exercise_id_b}")
    scores_a = await run_scoring_experiment(exercise_id_a)
    scores_b = await run_scoring_experiment(exercise_id_b)

    if scores_a and scores_b:
        print(f"\n── A/B Comparison ──────────────────────────────────")
        print(f"{'Metric':25s} {'Exercise A':12s} {'Exercise B':12s} {'Delta':10s}")
        print("-" * 65)
        for k in scores_a:
            a, b = scores_a.get(k, 0), scores_b.get(k, 0)
            delta = b - a
            sign = "+" if delta >= 0 else ""
            print(f"{k:25s} {a:12.3f} {b:12.3f} {sign}{delta:.3f}")

    return {"a": scores_a, "b": scores_b}


# ── Prompt Optimization Experiment ────────────────────────────────

PROMPT_VARIANTS = {
    "conservative": (
        "You are a cautious police dispatch commander. "
        "Always prioritize officer safety. NEVER assign fatigued units."
    ),
    "aggressive": (
        "You are a decisive police dispatch commander. "
        "Prioritize rapid incident response. Assign the nearest unit."
    ),
    "balanced": (
        "You are the Police Dispatch Commander. You coordinate multiple police units. "
        "Balance officer safety with rapid incident response. "
        "Consider fatigue, experience, and proximity."
    ),
}


async def run_prompt_experiment(exercise_id: str):
    """
    Test different Director system_prompt variants and score their outputs.
    """
    from state_store import get_state_store

    store = await get_state_store()
    state = await store.get(exercise_id)
    if not state or not state.active_events:
        logger.warning("No active events for prompt experiment")
        return {}

    lf = get_langfuse()
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
    event = state.active_events[0]

    results = {}

    for variant_name, system_prompt in PROMPT_VARIANTS.items():
        trace = lf.trace(
            name=f"prompt_variant_{variant_name}",
            session_id=f"{exercise_id}_prompt_exp",
            tags=["prompt_experiment", variant_name],
        )

        from state_store import build_dispatcher_prompt
        user_msg = build_dispatcher_prompt(event, state)

        generation = trace.generation(
            name="dispatch_decision",
            model="gpt-4o-mini",
            input={"system": system_prompt, "user": user_msg},
        )

        from langchain_core.messages import SystemMessage
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_msg),
        ])

        generation.end(output=response.content)

        # Score based on response quality heuristics
        has_json = response.content.strip().startswith("{")
        mentions_fatigue = "fatigue" in response.content.lower()
        mentions_units = "unit" in response.content.lower()

        score = (0.4 * has_json + 0.3 * mentions_fatigue + 0.3 * mentions_units)
        trace.score(name="response_quality", value=score)

        results[variant_name] = {
            "score": score,
            "has_json": has_json,
            "mentions_fatigue": mentions_fatigue,
        }
        logger.info(f"Prompt variant '{variant_name}': score={score:.2f}")

    lf.flush()
    print("\n── Prompt Variant Results ──")
    for v, r in results.items():
        print(f"  {v:15s}: {r['score']:.2f} (json={r['has_json']}, fatigue={r['mentions_fatigue']})")

    return results


# ── CLI ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Langfuse experiments for police simulation")
    parser.add_argument("--exercise-id", required=True, help="Exercise ID to evaluate")
    parser.add_argument("--exercise-id-b", help="Exercise ID B for A/B comparison")
    parser.add_argument("--create-dataset", action="store_true",
                        help="Create a Langfuse dataset from exercise decisions")
    parser.add_argument("--prompt-experiment", action="store_true",
                        help="Run prompt variant comparison experiment")
    parser.add_argument("--n", type=int, default=20, help="Number of decisions to score")
    parser.add_argument("--model", default="gpt-4o-mini", help="LLM model for scoring")

    args = parser.parse_args()

    async def main():
        if args.create_dataset:
            await create_dataset_from_exercise(args.exercise_id)
        elif args.exercise_id_b:
            await run_ab_experiment(args.exercise_id, args.exercise_id_b)
        elif args.prompt_experiment:
            await run_prompt_experiment(args.exercise_id)
        else:
            await run_scoring_experiment(args.exercise_id, args.n, args.model)

    asyncio.run(main())
