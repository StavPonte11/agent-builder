"""
Main v1 API router aggregator.
All sub-routers are registered here.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.base_prompts import router as base_prompts_router
from app.api.v1.blueprints import router as blueprints_router
from app.api.v1.mcp_tools import router as mcp_tools_router
from app.api.v1.message_templates import router as message_templates_router
from app.api.v1.organizations import router as organizations_router
from app.api.v1.skills import router as skills_router
from app.api.v1.users import router as users_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(organizations_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(base_prompts_router)
api_v1_router.include_router(message_templates_router)
api_v1_router.include_router(skills_router)
api_v1_router.include_router(mcp_tools_router)
api_v1_router.include_router(blueprints_router)

from app.api.v1.tools import router as tools_router
from app.api.v1.analytics import router as analytics_router
api_v1_router.include_router(tools_router)
api_v1_router.include_router(analytics_router)
# Phase 3 routers:
from app.api.v1.executions import router as executions_router
api_v1_router.include_router(executions_router)

# Phase 4 — Sandbox, Monitoring, Evaluation:
from app.api.v1.sandbox import router as sandbox_router
from app.api.v1.monitoring import router as monitoring_router
from app.api.v1.evaluation_datasets import router as evaluation_router
from app.api.v1.webhooks import router as webhooks_router
from app.api.v1.approvals import router as approvals_router

api_v1_router.include_router(sandbox_router)
api_v1_router.include_router(monitoring_router)
api_v1_router.include_router(evaluation_router)
api_v1_router.include_router(webhooks_router)
api_v1_router.include_router(approvals_router)

