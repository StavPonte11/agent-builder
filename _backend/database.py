from typing import AsyncGenerator
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
import os
from pydantic_settings import BaseSettings
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool

class Settings(BaseSettings):
    # Using asyncpg for SQLModel/FastAPI
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5433/agent_workflow_builder")
    # Using psycopg for LangGraph Checkpointer (required by the library)
    CHECKPOINTER_DB_URL: str = os.getenv("CHECKPOINTER_DB_URL", "postgresql://postgres:postgres@localhost:5433/agent_workflow_builder")

settings = Settings()

# --- SQLModel Engine (FastAPI CRUD) ---
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True,
    future=True,
    pool_size=20,
    max_overflow=40
)

async def init_db():
    async with engine.begin() as conn:
        # await conn.run_sync(SQLModel.metadata.drop_all) # WARNING: Only for dev reset
        await conn.run_sync(SQLModel.metadata.create_all)
    
    # Initialize Checkpointer tables
    async with get_checkpointer_pool() as pool:
        checkpointer = AsyncPostgresSaver(pool)
        await checkpointer.setup()

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session

# --- LangGraph Checkpointer (Temporal) ---
_checkpointer_pool: AsyncConnectionPool = None

def get_checkpointer_pool() -> AsyncConnectionPool:
    global _checkpointer_pool
    if _checkpointer_pool is None:
        _checkpointer_pool = AsyncConnectionPool(
            conninfo=settings.CHECKPOINTER_DB_URL,
            max_size=20,
            kwargs={"autocommit": True}
        )
    return _checkpointer_pool

async def get_checkpointer() -> AsyncPostgresSaver:
    pool = get_checkpointer_pool()
    return AsyncPostgresSaver(pool)
