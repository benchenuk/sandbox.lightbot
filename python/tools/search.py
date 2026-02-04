"""
Web Search Tool
Supports DuckDuckGo (default) and SearXNG providers.
"""

from typing import Any


class SearchTool:
    """Web search tool for retrieving current information."""
    
    def __init__(self, provider: str = "duckduckgo", base_url: str | None = None):
        self.provider = provider
        self.base_url = base_url
    
    async def search(self, query: str, max_results: int = 5) -> list[dict[str, Any]]:
        """Perform a web search and return results."""
        if self.provider == "duckduckgo":
            return await self._search_duckduckgo(query, max_results)
        elif self.provider == "searxng":
            return await self._search_searxng(query, max_results)
        else:
            raise ValueError(f"Unknown search provider: {self.provider}")
    
    async def _search_duckduckgo(
        self, query: str, max_results: int
    ) -> list[dict[str, Any]]:
        """Search using DuckDuckGo."""
        try:
            from duckduckgo_search import DDGS
            
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
            return [{"error": "duckduckgo_search not installed"}]
        except Exception as e:
            return [{"error": str(e)}]
    
    async def _search_searxng(
        self, query: str, max_results: int
    ) -> list[dict[str, Any]]:
        """Search using SearXNG instance."""
        import aiohttp
        
        base_url = self.base_url or "http://localhost:8080"
        url = f"{base_url}/search"
        
        params = {
            "q": query,
            "format": "json",
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    results = data.get("results", [])[:max_results]
                    return [
                        {
                            "title": r.get("title", ""),
                            "url": r.get("url", ""),
                            "snippet": r.get("content", ""),
                        }
                        for r in results
                    ]
                else:
                    return [{"error": f"HTTP {response.status}"}]
    
    def update_settings(self, provider: str | None = None, base_url: str | None = None):
        """Update search settings."""
        if provider:
            self.provider = provider
        if base_url:
            self.base_url = base_url
