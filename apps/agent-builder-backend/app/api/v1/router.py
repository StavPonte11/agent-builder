"""
Main v1 API router aggregator.
All sub-routers are registered here.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router

# Future routers imported here:
# from app.api.v1.blueprints import router as blueprints_router
# from app.api.v1.executions import router as executions_router
# etc.

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
# api_v1_router.include_router(blueprints_router)
# api_v1_router.include_router(executions_router)
