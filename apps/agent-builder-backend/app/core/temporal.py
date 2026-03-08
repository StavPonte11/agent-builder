"""
Temporal Client Initialization
"""
from temporalio.client import Client
import logging

logger = logging.getLogger(__name__)

async def get_temporal_client(url: str = "localhost:7233", namespace: str = "default") -> Client:
    """Gets or establishes a connection to the Temporal cluster."""
    try:
        client = await Client.connect(url, namespace=namespace)
        return client
    except Exception as e:
        logger.error(f"Failed to connect to Temporal cluster at {url}: {e}")
        raise
