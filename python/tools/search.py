"""
Web Search Tool
Supports DDGS (default) and SearXNG providers."""

import logging
from typing import Any

# Configure logging
logger = logging.getLogger("lightbot.search")


class SearchTool:
    """Web search tool for retrieving current information."""
    
    def __init__(self, provider: str = "ddgs", base_url: str | None = None):
        self.provider = provider
        self.base_url = base_url

    @property
    def display_name(self) -> str:
        """Return human-readable provider name."""
        return "DDGS" if self.provider == "ddgs" else "SearXNG"
    
    async def search(self, query: str, max_results: int = 5, **kwargs) -> list[dict[str, Any]]:
        """Perform a web search and return results."""
        if self.provider == "ddgs":
            return await self._search_ddgs(query, max_results)
        elif self.provider == "searxng":
            return await self._search_searxng(query, max_results, **kwargs)
        else:
            raise ValueError(f"Unknown search provider: {self.provider}")
    
    async def _search_ddgs(
        self, query: str, max_results: int
    ) -> list[dict[str, Any]]:
        """Search using DDGS."""
        try:
            from ddgs import DDGS
            
            results = []
            with DDGS() as ddgs:
                for r in ddgs.text(query, max_results=max_results):
                    results.append({
                        "title": r.get("title", ""),
                        "url": r.get("href", ""),
                        "snippet": r.get("body", ""),
                    })
            return results
        except ImportError:
            return [{"error": "ddgs not installed"}]
        except Exception as e:
            return [{"error": str(e)}]
    
    async def _search_searxng(
        self, query: str, max_results: int, categories: str | None = None, time_range: str | None = None
    ) -> list[dict[str, Any]]:
        """Search using SearXNG instance."""
        import aiohttp
        
        base_url = self.base_url or "http://localhost:8080"
        url = f"{base_url}/search"
        
        params = {
            "q": query,
            "format": "json",
            "limit": max_results,
        }
        
        if categories:
            params["categories"] = categories
        if time_range:
            params["time_range"] = time_range

        import json
        logger.info(f"[SearXNG] Request URL: {url}")
        logger.info(f"[SearXNG] Request Params: {json.dumps(params, indent=2)}")
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(url, params=params) as response:
                    logger.info(f"[SearXNG] Response Status: {response.status}")
                    if response.status == 200:
                        data = await response.json()
                        results = data.get("results", [])
                        
                        logger.info(f"[SearXNG] Found {len(results)} results")
                        
                        # Log detailed results for debugging
                        for i, r in enumerate(results[:max_results], 1):
                            title = r.get("title", "No Title")
                            engine = r.get("engine", "unknown")
                            score = r.get("score", "N/A")
                            logger.info(f"  [{i}] {title} (Engine: {engine}, Score: {score})")

                        # Log unresponsive engines
                        unresponsive = data.get("unresponsive_engines", [])
                        if unresponsive:
                            logger.warning(f"[SearXNG] Unresponsive engines: {unresponsive}")

                        return [
                            {
                                "title": r.get("title", ""),
                                "url": r.get("url", ""),
                                "snippet": r.get("content") or r.get("snippet") or "",
                            }
                            for r in results[:max_results]
                        ]
                    else:
                        error_msg = f"HTTP {response.status}"
                        logger.error(f"[SearXNG] Search failed: {error_msg}")
                        return [{"error": error_msg}]
            except Exception as e:
                logger.error(f"[SearXNG] Request error: {e}")
                return [{"error": str(e)}]
    
    def update_settings(self, provider: str | None = None, base_url: str | None = None):
        """Update search settings."""
        if provider:
            self.provider = provider
        if base_url:
            self.base_url = base_url
