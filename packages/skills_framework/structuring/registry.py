import uuid
import json
from typing import List, Optional, Dict, Any
from datetime import datetime
import os

class TemplateRegistry:
    """
    Manages storage, retrieval, and versioning of message templates.
    """
    
    def __init__(self, db_url: str = None):
        # In a real on-prem deploy, this connects to PostgreSQL using asyncpg + SQLAlchemy
        self.db_url = db_url or os.getenv("DATABASE_URL")
        self._mock_db = {} # template_id -> template_data
        self._mock_versions = {} # template_id -> list of versions
    
    async def register_template(
        self,
        group_id: str,
        template_name: str,
        schema: dict,
        examples: List[str],
        validation_rules: Optional[dict] = None,
        glossary_terms: Optional[List[str]] = None
    ) -> str:
        """Register a new template and return template_id"""
        template_id = str(uuid.uuid4())
        
        template_data = {
            "template_id": template_id,
            "group_id": group_id,
            "name": template_name,
            "schema": schema,
            "examples": examples,
            "validation_rules": validation_rules or {},
            "glossary_terms": glossary_terms or [],
            "version": "1.0.0",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        self._mock_db[template_id] = template_data
        self._mock_versions[template_id] = [template_data]
        
        return template_id
    
    async def get_template(self, template_id: str) -> Optional[dict]:
        """Retrieve template by ID"""
        return self._mock_db.get(template_id)
    
    async def search_templates(
        self,
        query: str,
        group_id: Optional[str] = None,
        top_k: int = 3
    ) -> List[dict]:
        """
        Find templates using semantic search.
        In production, this queries pgvector with the query embedding.
        """
        # Mock semantic search by just returning all templates for the group (up to top_k)
        results = []
        for t_id, t_data in self._mock_db.items():
            if not group_id or t_data["group_id"] == group_id:
                results.append(t_data)
        
        # In real implementation, sort by cosine similarity here
        return results[:top_k]
    
    async def update_template(
        self,
        template_id: str,
        updates: dict,
        version_increment: str = "minor"  # major, minor, patch
    ) -> str:
        """Update template with versioning"""
        if template_id not in self._mock_db:
            raise ValueError(f"Template {template_id} not found")
            
        current = self._mock_db[template_id].copy()
        
        # update fields
        for k, v in updates.items():
            current[k] = v
            
        # bump version
        major, minor, patch = map(int, current["version"].split("."))
        if version_increment == "major":
            major += 1; minor = 0; patch = 0
        elif version_increment == "minor":
            minor += 1; patch = 0
        else:
            patch += 1
            
        current["version"] = f"{major}.{minor}.{patch}"
        current["updated_at"] = datetime.utcnow().isoformat()
        
        self._mock_db[template_id] = current
        self._mock_versions[template_id].append(current)
        
        return current["version"]
    
    async def list_group_templates(self, group_id: str) -> List[dict]:
        """Get all templates for a group"""
        return [t for t in self._mock_db.values() if t["group_id"] == group_id]
