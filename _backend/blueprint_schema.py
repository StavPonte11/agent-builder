from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class NodeConfig(BaseModel):
    model: Optional[str] = None
    temperature: Optional[float] = 0.7
    system_prompt: Optional[str] = None
    tools: Optional[List[str]] = None
    servers: Optional[List[str]] = None

    class Config:
        extra = "allow"


class NodeSchema(BaseModel):
    id: str
    type: str
    label: Optional[str] = None
    description: Optional[str] = None
    position: Optional[Dict[str, float]] = None
    config: NodeConfig = Field(default_factory=NodeConfig)


class EdgeSchema(BaseModel):
    id: Optional[str] = None
    source: str
    target: str
    label: Optional[str] = None
    condition: Optional[str] = None   # Route key this edge matches (e.g. "medical_agent", "default")


class BlueprintSchema(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    nodes: List[NodeSchema]
    edges: List[EdgeSchema]
    entry_point: str
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        extra = "ignore"
