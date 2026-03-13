"""
Analytics routes.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.dependencies import CurrentUser, DbSession

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/global")
async def get_global_analytics(current_user: CurrentUser, db: DbSession, range: str = "7d") -> dict:
    """Mock global analytics endpoint for the UI dashboard."""
    return {
        "execution_count": 142,
        "success_rate": 98.5,
        "avg_duration_ms": 1250,
        "total_active_blueprints": 5,
        "cost_usd": 0.45,
        "charts": {
            "executions_over_time": [
                {"date": "2026-03-01", "count": 10},
                {"date": "2026-03-02", "count": 15},
                {"date": "2026-03-03", "count": 22},
                {"date": "2026-03-04", "count": 18},
                {"date": "2026-03-05", "count": 30},
                {"date": "2026-03-06", "count": 25},
                {"date": "2026-03-07", "count": 22},
            ]
        }
    }
