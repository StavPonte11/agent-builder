import os
import sys
import asyncio
import subprocess
import typer
from rich.console import Console

# Add parent directory to path so 'app' is discoverable
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.database import get_db, engine as async_engine, async_session_factory as async_session_maker
from app.models.blueprint import Blueprint

app = typer.Typer(help="Agent Builder Management CLI")
console = Console()

def run_cmd(cmd: str, cwd: str = None) -> None:
    """Run a shell command and stream output."""
    console.print(f"[dim]$ {cmd}[/dim]")
    subprocess.run(cmd, shell=True, check=True, cwd=cwd)

from app.models.organization import Organization
from app.models.user import User
from sqlalchemy import select
from datetime import datetime
import json

@app.command()
def seed():
    """Seed the database with professional blueprint templates."""
    console.print("[bold green]Seeding database with templates...[/bold green]")
    
    async def _seed():
        async with async_session_maker() as session:
            # Find an org and user to attach these to
            org_res = await session.execute(select(Organization).limit(1))
            org = org_res.scalar_one_or_none()
            user_res = await session.execute(select(User).limit(1))
            user = user_res.scalar_one_or_none()
            
            if not org or not user:
                console.print("[bold red]Please create at least 1 Organization and 1 User first via the API or another script.[/bold red]")
                return

            # Test if already seeded
            existing_res = await session.execute(select(Blueprint).where(Blueprint.name == "Customer Support Auto-Responder"))
            if existing_res.scalar_one_or_none():
                console.print("[yellow]Templates already seeded.[/yellow]")
                return

            templates = [
                Blueprint(
                    org_id=org.id,
                    created_by=user.id,
                    name="Customer Support Auto-Responder",
                    description="Automatically triage and respond to customer emails using a supervisor LLM.",
                    blueprint_type="workflow",
                    status="published",
                    definition={
                        "nodes": [
                            {"id": "n1", "type": "trigger", "position": {"x": 100, "y": 100}, "data": {"label": "Webhook Trigger"}},
                            {"id": "n2", "type": "llm", "position": {"x": 350, "y": 100}, "data": {"label": "Analyze Intent"}},
                            {"id": "n3", "type": "router", "position": {"x": 600, "y": 100}, "data": {"label": "Route Request"}},
                            {"id": "n4", "type": "output", "position": {"x": 900, "y": 100}, "data": {"label": "Send Reply"}}
                        ],
                        "edges": [
                            {"id": "e1", "source": "n1", "target": "n2"},
                            {"id": "e2", "source": "n2", "target": "n3"},
                            {"id": "e3", "source": "n3", "target": "n4"}
                        ]
                    }
                ),
                Blueprint(
                    org_id=org.id,
                    created_by=user.id,
                    name="PDF Financial Researcher",
                    description="Extracts data from 10-K PDFs and summaries findings.",
                    blueprint_type="agent",
                    status="published",
                    definition={
                        "nodes": [
                            {"id": "n1", "type": "trigger", "position": {"x": 100, "y": 100}, "data": {"label": "Start"}},
                            {"id": "n2", "type": "tool", "position": {"x": 350, "y": 100}, "data": {"label": "Fetch PDF"}},
                            {"id": "n3", "type": "llm", "position": {"x": 600, "y": 100}, "data": {"label": "Extract Tables"}},
                            {"id": "n4", "type": "output", "position": {"x": 900, "y": 100}, "data": {"label": "Save to DB"}}
                        ],
                        "edges": [
                            {"id": "e1", "source": "n1", "target": "n2"},
                            {"id": "e2", "source": "n2", "target": "n3"},
                            {"id": "e3", "source": "n3", "target": "n4"}
                        ]
                    }
                ),
                Blueprint(
                    org_id=org.id,
                    created_by=user.id,
                    name="Multi-Agent Debate",
                    description="Two AI personas debate a topic, graded by a judge.",
                    blueprint_type="agent",
                    status="published",
                    definition={
                        "nodes": [
                            {"id": "n1", "type": "trigger", "position": {"x": 100, "y": 200}, "data": {"label": "Start Debate"}},
                            {"id": "n2", "type": "parallel_fork", "position": {"x": 350, "y": 200}, "data": {"label": "Fork Agents"}},
                            {"id": "n3", "type": "llm", "position": {"x": 600, "y": 100}, "data": {"label": "Agent A (Pro)"}},
                            {"id": "n4", "type": "llm", "position": {"x": 600, "y": 300}, "data": {"label": "Agent B (Con)"}},
                            {"id": "n5", "type": "llm_judge", "position": {"x": 850, "y": 200}, "data": {"label": "Judge Panel"}},
                            {"id": "n6", "type": "output", "position": {"x": 1100, "y": 200}, "data": {"label": "Final Verdict"}}
                        ],
                        "edges": [
                            {"id": "e1", "source": "n1", "target": "n2"},
                            {"id": "e2", "source": "n2", "target": "n3"},
                            {"id": "e3", "source": "n2", "target": "n4"},
                            {"id": "e4", "source": "n3", "target": "n5"},
                            {"id": "e5", "source": "n4", "target": "n5"},
                            {"id": "e6", "source": "n5", "target": "n6"}
                        ]
                    }
                )
            ]
            
            session.add_all(templates)
            await session.commit()
            
            console.print("[bold green]✓ Database seeded successfully with 3 templates.[/bold green]")
            
    asyncio.run(_seed())


@app.command()
def demo():
    """Start all local backend services (FastAPI + Temporal worker)"""
    console.print("[bold blue]Starting local demo environment...[/bold blue]")
    try:
        worker_process = subprocess.Popen(["python", "-m", "app.temporal.worker"])
        api_process = subprocess.Popen(["uvicorn", "app.main:app", "--reload", "--port", "8000"])
        
        worker_process.wait()
        api_process.wait()
    except KeyboardInterrupt:
        console.print("\n[bold yellow]Stopping services...[/bold yellow]")
        if 'worker_process' in locals(): worker_process.terminate()
        if 'api_process' in locals(): api_process.terminate()

if __name__ == "__main__":
    app()
