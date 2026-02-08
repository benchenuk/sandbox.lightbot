"""
Tests for the ChatEngine logic.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from engine import ChatEngine
from llama_index.core.llms import ChatMessage, MessageRole

@pytest.fixture
def chat_engine():
    # Mock LLMs to avoid real calls
    with patch("engine.OpenAILike"):
        engine = ChatEngine()
        engine.llm = AsyncMock()
        engine.fast_llm = AsyncMock()
        engine.search_tool = AsyncMock()
        return engine

@pytest.mark.asyncio
async def test_rewrite_query_no_history(chat_engine):
    query = "Who is he?"
    # Mock rewrite to return original query
    chat_engine.query_rewriter.rewrite = AsyncMock(return_value={"query": query, "params": {}})
    
    rewritten, params = await chat_engine._rewrite_query(query, [])
    assert rewritten == query
    assert params == {}

@pytest.mark.asyncio
async def test_rewrite_query_with_history(chat_engine):
    query = "How old is he?"
    history = [
        ChatMessage(role=MessageRole.USER, content="Who is Tim Cook?"),
        ChatMessage(role=MessageRole.ASSISTANT, content="He is the CEO of Apple.")
    ]
    
    # Mock fast_llm response
    chart_engine_mock_rewrite_result = {
        "query": "How old is Tim Cook?",
        "params": {}
    }
    chat_engine.query_rewriter.rewrite = AsyncMock(return_value=chart_engine_mock_rewrite_result)
    
    rewritten, params = await chat_engine._rewrite_query(query, history)
    
    assert rewritten == "How old is Tim Cook?"
    assert params == {}
    chat_engine.query_rewriter.rewrite.assert_called_once()

@pytest.mark.asyncio
async def test_chat_search_on(chat_engine):
    # Setup mocks
    chat_engine._rewrite_query = AsyncMock(return_value=("standalone query", {"categories": "it"}))
    chat_engine._get_search_context = AsyncMock(return_value="search results")
    
    mock_chat_response = MagicMock()
    mock_chat_response.message.content = "Answer based on search"
    chat_engine.llm.achat.return_value = mock_chat_response
    
    response = await chat_engine.chat("my query", search_mode="on")
    
    assert response == "Answer based on search"
    chat_engine._rewrite_query.assert_called_once()
    chat_engine._get_search_context.assert_called_once_with("standalone query", {"categories": "it"})
