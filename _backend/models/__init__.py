"""
Unified data models for Workflow & Agent Builder Platform
Supports both workflow automation and intelligent agent creation
"""

from typing import Annotated

from pydantic import Field

PositiveInt = Annotated[int, Field(gt=0)]
