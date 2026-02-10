from typing import List, Any, TypedDict
import logging
import re
from llama_index.core.llms import ChatMessage
from prompts import REWRITE_QUERY_SYSTEM_PROMPT_TEMPLATE

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
        """DDGS specific rewrite logic - uses same prompt but only extracts QUERY."""
        return await self._rewrite_with_template(message, history_str, llm)

    async def _rewrite_searxng(self, message: str, history_str: str, llm: Any) -> RewriteResult:
        """SearXNG specific rewrite logic - extracts QUERY, CATEGORIES, and TIME_RANGE."""
        result = await self._rewrite_with_template(message, history_str, llm)
        # SearXNG uses the params, DDGS ignores them
        return result

    async def _rewrite_with_template(self, message: str, history_str: str, llm: Any) -> RewriteResult:
        """Shared rewrite logic using the unified prompt template."""
        full_prompt = REWRITE_QUERY_SYSTEM_PROMPT_TEMPLATE.format(
            chat_history=history_str,
            question=message
        )

        try:
            response = await llm.acomplete(full_prompt)
            text = response.text.strip()
            logger.info(f"[DEBUG] Raw rewrite response:\n{text}")

            parsed = {}
            # Match lines like "KEY = VALUE" or "**KEY:** VALUE" or "KEY: VALUE"
            # Being flexible with separators (: or =) and optional markdown bolding
            pattern = re.compile(r'(?:\*\*|)?([A-Z_]+)(?:\*\*|)?\s*[:=]\s*(.*)', re.IGNORECASE)

            for line in text.splitlines():
                match = pattern.search(line)
                if match:
                    key = match.group(1).upper()
                    val = match.group(2).strip()
                    # Remove potential trailing markdown or quotes and re-strip
                    val = val.strip('"`*').strip()
                    parsed[key] = val

            if not parsed:
                return {"query": message, "params": {}}

            params = {}
            if "CATEGORIES" in parsed:
                params["categories"] = parsed["CATEGORIES"]

            if "TIME_RANGE" in parsed:
                tr = parsed["TIME_RANGE"]
                params["time_range"] = tr if tr.lower() != "null" else None

            return {
                "query": parsed.get("QUERY", message),
                "params": params
            }
        except Exception as e:
            logger.error(f"Error in query rewrite: {e}")
            return {"query": message, "params": {}}
