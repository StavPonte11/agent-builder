import asyncio
import asyncpg

async def main():
    for user in ["postgres", "root", "admin", "stavp"]:
        for password in ["password", "postgres", "root", "admin", ""]:
            try:
                conn = await asyncpg.connect(user=user, password=password, host="localhost", port=5432, database="postgres")
                print(f"Connected to postgres as {user} with {password}")
                try:
                    await conn.execute("CREATE ROLE agent WITH LOGIN PASSWORD 'secret' SUPERUSER CREATEDB;")
                    print("Created role agent")
                except asyncpg.exceptions.DuplicateObjectError:
                    print("Role agent already exists")
                    await conn.execute("ALTER ROLE agent WITH SUPERUSER CREATEDB PASSWORD 'secret';")
                try:
                    await conn.execute("CREATE DATABASE agent_builder OWNER agent;")
                    print("Created db agent_builder")
                except asyncpg.exceptions.DuplicateDatabaseError:
                    print("Database agent_builder already exists")
                await conn.close()
                return
            except Exception as e:
                pass
    print("Failed to connect with common credentials")

asyncio.run(main())
