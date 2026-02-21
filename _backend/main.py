import asyncio
import sys
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from database import init_db
from infra.temporal_client import TemporalClientManager
from infra.observability import setup_observability

# Import routers
from routers import blueprints, exercises, templates, skills, structuring, tools, schedules, execution

load_dotenv()

if sys.platform == 'win32':
    # Force SelectorEventLoop for psycopg compatibility on Windows
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    # Ensure Temporal Client is connected
    await TemporalClientManager.get_client()
    yield
    # Shutdown
    await TemporalClientManager.close()

app = FastAPI(lifespan=lifespan)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3002", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Observability ---
setup_observability(app)

# --- Register Routers ---
app.include_router(blueprints.router)
app.include_router(execution.router)
app.include_router(exercises.router)
app.include_router(templates.router)
app.include_router(skills.router)
app.include_router(structuring.router)
app.include_router(tools.router)
app.include_router(schedules.router)

@app.get("/")
async def root():
    return {"status": "ok", "message": "Agent Builder API is running"}
