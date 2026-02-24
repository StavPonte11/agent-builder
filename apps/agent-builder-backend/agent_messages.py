"""
agent_messages.py — Phase 2: Inter-Agent Communication Protocol

Provides:
 - AgentMessageBus: Redis pub/sub based message routing between agents
 - Temporal Signal helpers for agent triggering
 - Message Router: routes messages to specific agents or broadcasts
"""

import asyncio
import json
import logging
from typing import Callable, Awaitable

import redis.asyncio as aioredis
from state_store import AgentMessage, get_redis

logger = logging.getLogger(__name__)

# ── Channel Naming ─────────────────────────────────────────────────

def channel_for(exercise_id: str, agent: str = "broadcast") -> str:
    """Redis pub/sub channel name for a specific agent or broadcast."""
    return f"exercise:{exercise_id}:agent:{agent}"


# ── Message Bus ────────────────────────────────────────────────────

class AgentMessageBus:
    """
    Thin wrapper around Redis pub/sub for inter-agent message routing.
    
    Agents publish to their own channel, and subscribe to their own + broadcast.
    The Director subscribes to all channels via pattern.
    
    Usage:
        bus = AgentMessageBus(redis_client, exercise_id)
        await bus.publish(message)
        
        # In a long-running agent loop:
        async for msg in bus.subscribe("police_dispatch"):
            await handle(msg)
    """

    def __init__(self, redis: aioredis.Redis, exercise_id: str):
        self._r = redis
        self._exercise_id = exercise_id
        self._pubsub: aioredis.client.PubSub | None = None

    async def publish(self, message: AgentMessage) -> int:
        """
        Route the message:
        - "broadcast" → publish to the broadcast channel (all agents receive it)
        - specific agent name → publish to that agent's channel
        Returns the number of subscribers that received it.
        """
        channel = channel_for(self._exercise_id, message.to_agent)
        payload = message.model_dump_json()
        count = await self._r.publish(channel, payload)
        logger.debug(f"[MessageBus] {message.from_agent} → {message.to_agent} ({message.message_type}) [{count} receivers]")
        return count

    async def subscribe(
        self,
        agent_name: str,
        also_broadcast: bool = True,
    ):
        """
        Async generator that yields AgentMessages addressed to `agent_name`
        and optionally to "broadcast".
        
        Yields messages until the exercise ends or caller breaks.
        """
        redis = await get_redis()
        pubsub = redis.pubsub()
        channels = [channel_for(self._exercise_id, agent_name)]
        if also_broadcast:
            channels.append(channel_for(self._exercise_id, "broadcast"))

        await pubsub.subscribe(*channels)
        logger.info(f"[MessageBus] {agent_name} subscribed to {channels}")

        try:
            async for raw_msg in pubsub.listen():
                if raw_msg["type"] != "message":
                    continue
                try:
                    msg = AgentMessage.model_validate_json(raw_msg["data"])
                    yield msg
                except Exception as e:
                    logger.warning(f"[MessageBus] Failed to parse message: {e}")
        finally:
            await pubsub.unsubscribe(*channels)
            await pubsub.aclose()

    async def close(self) -> None:
        if self._pubsub:
            await self._pubsub.aclose()


# ── Message Router ─────────────────────────────────────────────────

class MessageRouter:
    """
    Higher-level router that dispatches messages to registered handler callbacks.
    
    Usage:
        router = MessageRouter(bus, agent_name="police_dispatch")
        router.on("task_assignment", handle_task)
        router.on("alert", handle_alert)
        await router.run()  # blocks, processes messages until stopped
    """

    def __init__(self, bus: AgentMessageBus, agent_name: str):
        self._bus = bus
        self._agent_name = agent_name
        self._handlers: dict[str, Callable[[AgentMessage], Awaitable[None]]] = {}
        self._running = False

    def on(self, message_type: str, handler: Callable[[AgentMessage], Awaitable[None]]) -> "MessageRouter":
        """Register a handler for a specific message type. Returns self for chaining."""
        self._handlers[message_type] = handler
        return self

    async def run(self) -> None:
        """Process messages until stop() is called."""
        self._running = True
        async for msg in self._bus.subscribe(self._agent_name):
            if not self._running:
                break
            handler = self._handlers.get(msg.message_type)
            if handler:
                try:
                    await handler(msg)
                except Exception as e:
                    logger.error(f"[Router:{self._agent_name}] Handler error for {msg.message_type}: {e}")
            else:
                logger.debug(f"[Router:{self._agent_name}] No handler for message type: {msg.message_type}")

    def stop(self) -> None:
        self._running = False


# ── Temporal Signal Helpers ────────────────────────────────────────

async def signal_exercise_event(
    temporal_client,
    workflow_id: str,
    signal_name: str,
    payload: dict,
) -> None:
    """
    Send a Temporal Signal to a running exercise workflow.
    
    This allows external triggers (human instructor override, new events)
    to reach a running workflow.
    
    Args:
        temporal_client: Connected Temporal client
        workflow_id: ID of the running AgentExecutionWorkflow
        signal_name: e.g. "inject_event", "pause", "override_unit"
        payload: Signal data
    """
    handle = temporal_client.get_workflow_handle(workflow_id)
    await handle.signal(signal_name, payload)
    logger.info(f"[Signal] Sent '{signal_name}' to workflow {workflow_id}")


async def query_exercise_status(temporal_client, workflow_id: str) -> dict:
    """
    Query a running exercise workflow for its current status.
    Returns the workflow's query result.
    """
    handle = temporal_client.get_workflow_handle(workflow_id)
    result = await handle.query("exercise_status")
    return result


# ── Factory ────────────────────────────────────────────────────────

async def create_message_bus(exercise_id: str) -> AgentMessageBus:
    """Create a MessageBus for a given exercise. Used in workers."""
    redis = await get_redis()
    return AgentMessageBus(redis, exercise_id)
