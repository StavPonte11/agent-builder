from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field, Relationship, JSON
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB

class Organization(SQLModel, table=True):
    __tablename__ = "organizations"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    users: List["User"] = Relationship(back_populates="organization")
    blueprints: List["AgentBlueprint"] = Relationship(back_populates="organization")

class User(SQLModel, table=True):
    __tablename__ = "users"
    id: str = Field(primary_key=True) # External ID from OIDC
    email: Optional[str] = None
    organization_id: Optional[UUID] = Field(default=None, foreign_key="organizations.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    organization: Optional[Organization] = Relationship(back_populates="users")
    blueprints: List["AgentBlueprint"] = Relationship(back_populates="owner")
    executions: List["ExecutionSession"] = Relationship(back_populates="user")

class AgentBlueprint(SQLModel, table=True):
    __tablename__ = "agent_blueprints"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    description: Optional[str] = None
    blueprint_data: Dict[str, Any] = Field(default={}, sa_column=Column(JSONB)) # The JSON Graph
    
    owner_id: str = Field(foreign_key="users.id")
    organization_id: Optional[UUID] = Field(default=None, foreign_key="organizations.id")
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    owner: User = Relationship(back_populates="blueprints")
    organization: Optional[Organization] = Relationship(back_populates="blueprints")
    executions: List["ExecutionSession"] = Relationship(back_populates="blueprint")

class ExecutionSession(SQLModel, table=True):
    __tablename__ = "execution_sessions"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    blueprint_id: UUID = Field(foreign_key="agent_blueprints.id")
    user_id: str = Field(foreign_key="users.id")
    
    workflow_id: str # Temporal Workflow ID
    run_id: Optional[str] = None # Temporal Run ID
    status: str = Field(default="pending") # running, completed, failed
    
    input_data: Dict[str, Any] = Field(default={}, sa_column=Column(JSONB))
    result_data: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSONB))
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    
    blueprint: AgentBlueprint = Relationship(back_populates="executions")
    user: User = Relationship(back_populates="executions")


# ── Template Registry ─────────────────────────────────────────────

class MessageTemplate(SQLModel, table=True):
    """A message template for a specific chat group.
    Defines the structured output schema, glossary, and few-shot examples."""
    __tablename__ = "message_templates"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    group_id: str = Field(index=True, unique=True)  # Unique chat group identifier
    name: str
    description: Optional[str] = None
    language: str = Field(default="he")             # he | en | ar

    # Field definitions: [{name, type, description, required, example, is_geo}]
    fields: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSONB))

    # Glossary: [{"term": "ועדה", "meaning": "committee", "aliases": ["ועד"]}]
    glossary_terms: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSONB))

    # Few-shot examples: [{"input": "...", "output": {...}}]
    few_shot_examples: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSONB))

    # Optional link to the agent blueprint that handles structuring for this group
    blueprint_id: Optional[UUID] = Field(default=None, foreign_key="agent_blueprints.id")

    owner_id: str = Field(default="user_default")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Skill(SQLModel, table=True):
    """A reusable AI skill — a prompt template + tool list + default parameters.
    Skills are attached to agent blueprints or used directly by the structuring pipeline."""
    __tablename__ = "skills"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = None

    # Skill type: structuring | retrieval | classifier | geocoding | validation
    skill_type: str = Field(default="structuring")

    # System prompt with placeholders: {template_schema}, {glossary}, {examples}, {language}
    prompt_template: str = Field(default="")

    # List of tool names this skill is allowed to call
    tools: List[str] = Field(default=[], sa_column=Column(JSONB))

    # Default LLM parameters
    parameters: Dict[str, Any] = Field(
        default={"model": "gpt-4o", "temperature": 0.1, "max_tokens": 2048},
        sa_column=Column(JSONB),
    )

    owner_id: str = Field(default="user_default")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
