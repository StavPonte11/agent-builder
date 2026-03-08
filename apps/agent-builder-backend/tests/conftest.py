import collections
import collections.abc
collections.Callable = collections.abc.Callable

import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

@pytest.fixture
def mock_db_session():
    # Return an AsyncMock representing an SQLAlchemy AsyncSession
    session = AsyncMock(spec=AsyncSession)
    return session
