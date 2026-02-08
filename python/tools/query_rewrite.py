from typing import List, Any, TypedDict
import logging
import re
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
        """SearXNG specific rewrite logic with robust Key = Value output."""
        
        system_prompt = (
            "You are a search query optimizer. "
            "Your goal is to rewrite the user's request into a precise search query and extract relevant parameters. "
            "Return the output in the following 'Key = Value' format:\n\n"
            "QUERY = <optimized search query>\n"
            "CATEGORIES = <comma-separated categories>\n"
            "TIME_RANGE = <day|week|month|year|null>\n\n"
            "Available categories: general, it, news, science, files, images, videos, music, map, social_media. "
            "If none perform strongly, use 'general'.\n\n"
            "Example:\n"
            "QUERY = python async await tutorial\n"
            "CATEGORIES = it\n"
            "TIME_RANGE = year"
        )

        user_prompt = (
            f"Conversation History:\n{history_str}\n\n"
            f"Current Request: {message}\n\n"
            "Provide the rewritten query and parameters."
        )
        
        full_prompt = f"{system_prompt}\n\n{user_prompt}"

        try:
            response = await llm.acomplete(full_prompt)
            text = response.text.strip()
            
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
            logger.error(f"Error in SearXNG rewrite: {e}")
            return {"query": message, "params": {}}
