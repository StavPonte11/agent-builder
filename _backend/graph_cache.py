from typing import Dict, Any, Optional
from uuid import UUID
from datetime import datetime, timedelta

class GraphCache:
    _cache: Dict[str, Any] = {}
    _timestamps: Dict[str, datetime] = {}
    
    TTL_SECONDS = 300 # 5 minutes

    @classmethod
    def get(cls, blueprint_id, execution_mode: str = "production") -> Optional[Any]:
        key = f"{str(blueprint_id)}_{execution_mode}"
        
        if key not in cls._cache:
            return None
            
        # Check TTL
        cached_time = cls._timestamps.get(key)
        if cached_time and (datetime.utcnow() - cached_time) > timedelta(seconds=cls.TTL_SECONDS):
            del cls._cache[key]
            del cls._timestamps[key]
            return None
            
        return cls._cache[key]

    @classmethod
    def set(cls, blueprint_id, graph_runnable: Any, execution_mode: str = "production"):
        key = f"{str(blueprint_id)}_{execution_mode}"
        cls._cache[key] = graph_runnable
        cls._timestamps[key] = datetime.utcnow()

    @classmethod
    def invalidate(cls, blueprint_id):
        str_id = str(blueprint_id)
        # Clear all variants (prod/sandbox)
        keys_to_remove = [k for k in cls._cache.keys() if k.startswith(str_id)]
        for k in keys_to_remove:
            if k in cls._cache:
                del cls._cache[k]
            if k in cls._timestamps:
                del cls._timestamps[k]
