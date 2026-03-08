"""
Auto-evaluation + auto-pause Celery task.

After completing an execution, runs LLM judge evaluation across all
configured EvalDimensions. If consecutive failures threshold is reached,
pauses the blueprint and notifies admins.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from celery import shared_task

log = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def run_evaluation(self, execution_id: str, blueprint_id: str) -> dict:
    """
    1. Load blueprint evaluation config
    2. For each scoring dimension, call the judge LLM
    3. Record scores + reasoning to DB and Langfuse
    4. Check if consecutive_failures threshold reached → auto-pause
    5. Send admin notification if paused
    """
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run_evaluation_async(execution_id, blueprint_id))
    finally:
        loop.close()


async def _run_evaluation_async(execution_id: str, blueprint_id: str) -> dict:
    from app.db.session import async_session_factory
    from app.services.llm_provider_pool import LLMProviderPool
    from sqlalchemy import text
    import os
    import redis.asyncio as aioredis

    async with async_session_factory() as db:
        # Load execution + blueprint evaluation config
        result = await db.execute(
            text("""
                SELECT e.final_state, e.cost_usd, e.total_duration_ms,
                       b.evaluation_config, b.name AS blueprint_name
                FROM executions e
                JOIN blueprints b ON b.id = e.blueprint_id
                WHERE e.id = :exec_id AND b.id = :bp_id
            """),
            {"exec_id": execution_id, "bp_id": blueprint_id},
        )
        row = result.mappings().first()
        if not row or not row["evaluation_config"]:
            log.info("No evaluation config for blueprint %s", blueprint_id)
            return {"skipped": True}

        eval_cfg = row["evaluation_config"]
        if not eval_cfg.get("auto_evaluate"):
            return {"skipped": True}

        final_state = row["final_state"] or {}
        dimensions: list[dict] = eval_cfg.get("scoring_dimensions", [])
        judge_model = eval_cfg.get("judge_model", os.getenv("EVALUATION_JUDGE_MODEL", "gpt-4o"))
        pass_threshold = eval_cfg.get("pass_threshold", 0.7)

        if not dimensions:
            return {"skipped": True, "reason": "no dimensions configured"}

        pool = LLMProviderPool()
        scores: list[dict] = []

        for dim in dimensions:
            system = (
                "You are an objective evaluator. Score the AI workflow output on a scale from 0.0 to 1.0 "
                f"based on this rubric: {dim.get('rubric', '')}. "
                "Respond ONLY with a JSON object: {\"score\": <float>, \"reasoning\": \"<one sentence>\"}."
            )
            user = f"WORKFLOW OUTPUT:\n{json.dumps(final_state, indent=2)[:4000]}"

            try:
                raw = pool.call(
                    model=judge_model,
                    system=system,
                    user=user,
                    max_tokens=256,
                    temperature=0.0,
                )
                parsed = json.loads(raw)
                score = float(parsed.get("score", 0))
                reasoning = parsed.get("reasoning", "")
            except Exception as err:
                log.warning("Judge call failed for dimension %s: %s", dim.get("name"), err)
                score = 0.0
                reasoning = f"Evaluation error: {err}"

            scores.append({
                "dimension": dim.get("name", "unknown"),
                "weight": dim.get("weight", 1.0),
                "score": score,
                "reasoning": reasoning,
            })

        # Weighted aggregate score
        total_weight = sum(s["weight"] for s in scores) or 1
        aggregate = sum(s["score"] * s["weight"] for s in scores) / total_weight
        passed = aggregate >= pass_threshold

        # Persist evaluation result
        eval_id = __import__("uuid").uuid4()
        await db.execute(
            text("""
                INSERT INTO execution_evaluations
                    (id, execution_id, blueprint_id, aggregate_score, passed, dimensions, judge_model)
                VALUES (:id, :exec_id, :bp_id, :score, :passed, :dims::jsonb, :model)
            """),
            {
                "id": str(eval_id),
                "exec_id": execution_id,
                "bp_id": blueprint_id,
                "score": aggregate,
                "passed": passed,
                "dims": json.dumps(scores),
                "model": judge_model,
            },
        )

        # ── Auto-pause logic ──────────────────────────────────────────────────
        auto_pause_after = eval_cfg.get("auto_pause_after_failures",
                                        int(os.getenv("AUTO_PAUSE_AFTER_CONSECUTIVE_FAILURES", "3")))

        r = aioredis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"))
        counter_key = f"bp:{blueprint_id}:consecutive_eval_failures"

        if passed:
            await r.delete(counter_key)
        else:
            fail_count = await r.incr(counter_key)
            await r.expire(counter_key, 86400 * 7)   # 7-day rolling window

            if fail_count >= auto_pause_after:
                # Pause the blueprint
                await db.execute(
                    text("UPDATE blueprints SET status = 'paused' WHERE id = :id"),
                    {"id": blueprint_id},
                )
                log.warning(
                    "Blueprint %s (%s) AUTO-PAUSED after %d consecutive eval failures (score %.2f < %.2f)",
                    blueprint_id, row["blueprint_name"], fail_count, aggregate, pass_threshold,
                )
                # Notify admins
                notify_admins.delay(
                    blueprint_id=blueprint_id,
                    blueprint_name=row["blueprint_name"],
                    aggregate_score=aggregate,
                    fail_count=int(fail_count),
                    pass_threshold=pass_threshold,
                )

        await db.commit()
        await r.aclose()

        return {
            "evaluation_id": str(eval_id),
            "aggregate_score": round(aggregate, 4),
            "passed": passed,
            "dimensions": scores,
        }


@shared_task(ignore_result=True)
def notify_admins(blueprint_id: str, blueprint_name: str, aggregate_score: float,
                  fail_count: int, pass_threshold: float) -> None:
    """
    Send in-app notifications to all org admins when a blueprint is auto-paused.
    """
    import asyncio

    async def _notify():
        from app.db.session import async_session_factory
        from sqlalchemy import text

        async with async_session_factory() as db:
            # Get admin user IDs
            result = await db.execute(text("SELECT id FROM users WHERE role = 'admin'"))
            admin_ids = [str(row[0]) for row in result.fetchall()]

            for admin_id in admin_ids:
                await db.execute(
                    text("""
                        INSERT INTO notifications (id, user_id, type, title, body, blueprint_id)
                        VALUES (gen_random_uuid(), :user_id, 'auto_pause', :title, :body, :bp_id)
                    """),
                    {
                        "user_id": admin_id,
                        "title": f"Blueprint Auto-Paused: {blueprint_name}",
                        "body": (
                            f"Blueprint '{blueprint_name}' was automatically paused after "
                            f"{fail_count} consecutive evaluation failures. "
                            f"Last score: {aggregate_score:.2f} (threshold: {pass_threshold:.2f})."
                        ),
                        "bp_id": blueprint_id,
                    },
                )
            await db.commit()

    asyncio.run(_notify())
