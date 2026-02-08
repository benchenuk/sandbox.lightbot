from typing import List, Any, TypedDict
import logging
from llama_index.core.llms import ChatMessage
from prompts import CONDENSE_QUESTION_PROMPT

logger = logging.getLogger("lightbot.query_rewrite")

class RewriteResult(TypedDict):
    query: str
    params: dict[str, Any]

class QueryRewriter:
    """Tool for rewriting user queries for better search results."""
    
    def __init__(self, provider: str = "ddgs"):
        self.provider = provider

    async def rewrite(self, message: str, history: List[ChatMessage], llm: Any) -> RewriteResult:
        """Rewrite the query based on the search provider."""
        logger.info(f"[EVENT] Query rewrite started for provider: {self.provider}")
        
        if not history:
            return {"query": message, "params": {}}

        # Format history for prompt
        history_str = "\n".join([f"{m.role.value}: {m.content}" for m in history])

        if self.provider == "ddgs":
            return await self._rewrite_ddgs(message, history_str, llm)
        elif self.provider == "searxng":
            return await self._rewrite_searxng(message, history_str, llm)
        else:
            logger.warning(f"Unknown provider {self.provider}, falling back to default rewrite")
            return await self._rewrite_ddgs(message, history_str, llm)

    async def _rewrite_ddgs(self, message: str, history_str: str, llm: Any) -> RewriteResult:
        """DDGS specific rewrite logic (placeholder for now)."""
        prompt = CONDENSE_QUESTION_PROMPT.format(
            chat_history=history_str, 
            question=message
        )
        try:
            response = await llm.acomplete(prompt)
            standalone_query = response.text.strip()
            return {
                "query": standalone_query if standalone_query else message,
                "params": {
                    "time_limit": None,  # Placeholder
                    "region": None       # Placeholder
                }
            }
        except Exception as e:
            logger.error(f"Error in DDGS rewrite: {e}")
            return {"query": message, "params": {}}

    async def _rewrite_searxng(self, message: str, history_str: str, llm: Any) -> RewriteResult:
        """SearXNG specific rewrite logic (placeholder for now)."""
        prompt = CONDENSE_QUESTION_PROMPT.format(
            chat_history=history_str, 
            question=message
        )
        try:
            response = await llm.acomplete(prompt)
            standalone_query = response.text.strip()
            return {
                "query": standalone_query if standalone_query else message,
                "params": {
                    "engines": None,    # Placeholder
                    "categories": None, # Placeholder
                    "time_range": None  # Placeholder
                }
            }
        except Exception as e:
            logger.error(f"Error in SearXNG rewrite: {e}")
            return {"query": message, "params": {}}
