import os
from temporalio.client import Client

class TemporalClientManager:
    _client: Client = None

    @classmethod
    async def get_client(cls) -> Client:
        if cls._client is None:
            temporal_host = os.getenv("TEMPORAL_HOST", "localhost:7233")
            cls._client = await Client.connect(temporal_host)
        return cls._client

    @classmethod
    async def close(cls):
        if cls._client:
            # specialized close logic if needed, usually client doesn't need explicit close
            # but good for cleanup in tests
            pass
