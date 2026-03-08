#!/usr/bin/env python
"""
run_tests.py — One-command runner for the agentic system test workflow.

This is the simplest way to execute the full test suite without pytest.
Produces a Markdown report and exits with code 0/1/2 based on quality score.

Usage:
    python run_tests.py                        # defaults from env vars
    python run_tests.py --backend http://...:8000 --email admin@org.com
    python run_tests.py --db-url postgresql+asyncpg://... --resume --thread-id <id>
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))  # add project root

from tests.test_workflow import run_test_workflow, resume_test_workflow
import asyncio
import argparse
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
    stream=sys.stdout,
)


def main():
    parser = argparse.ArgumentParser(
        description="Agent Builder — Agentic System Test Runner"
    )
    parser.add_argument("--backend",   default=os.getenv("BACKEND_BASE_URL", "http://localhost:8000"))
    parser.add_argument("--frontend",  default=os.getenv("FRONTEND_BASE_URL", "http://localhost:5173"))
    parser.add_argument("--email",     default=os.getenv("TEST_USER_EMAIL", "test@example.com"))
    parser.add_argument("--password",  default=os.getenv("TEST_USER_PASSWORD", "password123"))
    parser.add_argument("--db-url",    default=os.getenv("DATABASE_URL"))
    parser.add_argument("--thread-id", default=None, help="LangGraph thread ID for checkpointing")
    parser.add_argument("--output",    default="test_report.md")
    parser.add_argument(
        "--resume", action="store_true",
        help="Resume from last PostgreSQL checkpoint (requires --thread-id and --db-url)"
    )
    args = parser.parse_args()

    print("\n" + "═" * 70)
    print("  Agent Builder — System Test Workflow")
    print(f"  Backend:  {args.backend}")
    print(f"  Frontend: {args.frontend}")
    print(f"  Output:   {args.output}")
    print("═" * 70 + "\n")

    if args.resume:
        if not args.thread_id or not args.db_url:
            print("ERROR: --resume requires --thread-id and --db-url", file=sys.stderr)
            sys.exit(1)
        result = asyncio.run(resume_test_workflow(args.thread_id, args.db_url))
    else:
        result = asyncio.run(run_test_workflow(
            backend_url=args.backend,
            frontend_url=args.frontend,
            test_user_email=args.email,
            test_user_password=args.password,
            db_url=args.db_url,
            thread_id=args.thread_id,
            output_path=args.output,
        ))

    report = result.get("final_report", "No report generated.")
    print(report)

    score = result.get("aggregate_score", 0)
    passed = result.get("passed_tests", 0)
    total = result.get("total_tests", 0)
    print(f"\n{'═' * 70}")
    print(f"  Final Score: {score:.2f} | Tests: {passed}/{total} passed")
    print(f"  Report:      {args.output}")
    print(f"{'═' * 70}\n")

    sys.exit(0 if score >= 0.9 else 1 if score >= 0.5 else 2)


if __name__ == "__main__":
    main()
