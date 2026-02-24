from typing import List, Optional, Dict, Any
from .nlp import HebrewNLPProcessor

class GeoResolver:
    """
    Resolves Hebrew location mentions to coordinates/polygons.
    """
    
    def __init__(
        self,
        address_tool=None,  # e.g. mapping API tool wrapper
        nlp_processor: HebrewNLPProcessor = None
    ):
        self.address_tool = address_tool
        self.nlp = nlp_processor
        
    async def resolve_location(
        self,
        location_mention: str,
        context: Optional[str] = None
    ) -> dict:
        """
        Resolve location to geographic data.
        """
        # Mocking an external mapping tool call
        
        # Check if the tool is available
        if self.address_tool:
            # Use actual tool (e.g. google maps geocoding)
            return await self.address_tool.ainvoke(location_mention)
            
        # Fallback Mock Data
        mock_resolution = {
            "address": location_mention,
            "coordinates": [32.0853, 34.7818], # Tel Aviv Mock
            "polygon": None,
            "confidence": 0.85,
            "resolution_method": "mock_geocoder"
        }
        
        return mock_resolution
        
    async def extract_and_resolve(
        self,
        message: str,
        schema_field: dict
    ) -> dict:
        """
        End-to-end: extract location mentions and resolve them.
        """
        # 1. Extract mentions
        mentions = await self.nlp.extract_location_mentions(message) if self.nlp else []
        
        if not mentions:
            return {"error": "No location found in text"}
            
        candidate = mentions[0]["mention"]
        
        # 2. Resolve
        resolution = await self.resolve_location(candidate, message)
        
        return resolution
        
    async def disambiguate_location(
        self,
        candidates: List[str],
        message_context: str
    ) -> str:
        """Use context to choose correct location if ambiguous."""
        if not candidates:
            return ""
        # Assume LLM or heuristic picks the best contextual match
        return candidates[0]
        
    def requires_polygon(self, schema_field: dict) -> bool:
        """Check if schema requires polygon vs point"""
        return schema_field.get("type") == "polygon" or schema_field.get("format") == "geojson_polygon"
