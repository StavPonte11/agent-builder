import asyncio
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from db_models import User

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5433/agent_workflow_builder"

async def create_default_user():
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Create default user
        user = User(
            id="user_default",
            email="default@example.com",
            name="Default User"
        )
        session.add(user)
        await session.commit()
        print(f"✓ Created default user: {user.id}")

if __name__ == "__main__":
    asyncio.run(create_default_user())
