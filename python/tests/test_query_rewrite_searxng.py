import pytest
from unittest.mock import AsyncMock, MagicMock
from tools.query_rewrite import QueryRewriter

@pytest.fixture
def searxng_rewriter():
    return QueryRewriter(provider="searxng")

@pytest.fixture
def mock_llm():
    llm = AsyncMock()
    response = MagicMock()
    response.text = ""
    llm.acomplete.return_value = response
    return llm

@pytest.mark.asyncio
async def test_searxng_rewrite_simple(searxng_rewriter, mock_llm):
    # Mock LLM response for a simple query in Key = Value format
    mock_llm.acomplete.return_value.text = """
    QUERY = python tutorial
    CATEGORIES = it
    TIME_RANGE = null
    """
    
    result = await searxng_rewriter.rewrite("python tutorial", [], mock_llm)
    
    assert result["query"] == "python tutorial"
    assert result["params"]["categories"] == "it"
    assert result["params"]["time_range"] is None

@pytest.mark.asyncio
async def test_searxng_rewrite_complex(searxng_rewriter, mock_llm):
    # Mock LLM response for a complex query with time range and combined categories
    # Also testing variations like markdown bolding and colon
    mock_llm.acomplete.return_value.text = """
    **QUERY:** latest AI news
    CATEGORIES: it,news
    TIME_RANGE = week
    """
    
    result = await searxng_rewriter.rewrite("latest AI news", [], mock_llm)
    
    assert result["query"] == "latest AI news"
    assert result["params"]["categories"] == "it,news"
    assert result["params"]["time_range"] == "week"

@pytest.mark.asyncio
async def test_searxng_rewrite_with_extra_text(searxng_rewriter, mock_llm):
    # Mock LLM response with conversational filler
    mock_llm.acomplete.return_value.text = """
    Sure, I've optimized that for you:
    QUERY = climate change impact
    CATEGORIES = science,news
    TIME_RANGE = year
    I hope this helps!
    """
    
    result = await searxng_rewriter.rewrite("climate change", [], mock_llm)
    
    assert result["query"] == "climate change impact"
    assert result["params"]["categories"] == "science,news"
    assert result["params"]["time_range"] == "year"

@pytest.mark.asyncio
async def test_searxng_rewrite_fallback(searxng_rewriter, mock_llm):
    # Mock LLM response that doesn't follow the format at all
    mock_llm.acomplete.return_value.text = "I don't know how to rewrite this."
    
    result = await searxng_rewriter.rewrite("original query", [], mock_llm)
    
    # specific fallback behavior: original query, empty params
    assert result["query"] == "original query"
    assert result["params"] == {}
