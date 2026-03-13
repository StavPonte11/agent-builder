import asyncio
import asyncpg
import os

DATABASE_URL = "postgresql://agent:secret@localhost:5433/agent_builder"

async def patch_db():
    print("Connecting to DB...")
    conn = await asyncpg.connect(DATABASE_URL)
    print("Applying schema patch...")
    try:
        await conn.execute("ALTER TABLE organizations ADD COLUMN provider_keys JSONB;")
        print("Successfully added provider_keys column to organizations table.")
    except asyncpg.exceptions.DuplicateColumnError:
        print("Column already exists.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(patch_db())
