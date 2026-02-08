import asyncio
import aiohttp
import argparse
import json
import sys
from typing import Optional, List, Any

async def search_searxng(
    query: str,
    base_url: str = "http://localhost:8080",
    max_results: int = 5,
    categories: Optional[str] = None,
    engines: Optional[str] = None,
    language: str = "auto",
    time_range: Optional[str] = None,
    safesearch: int = 0,
    dump_json: bool = False
) -> None:
    """
    Perform a search against a SearXNG instance and print results/debug info.
    """
    # Remove trailing slash from base_url if present
    base_url = base_url.rstrip("/")
    url = f"{base_url}/search"
    
    # Construct parameters
    params = {
        "q": query,
        "format": "json",
    }
    
    if categories:
        params["categories"] = categories
    if engines:
        params["engines"] = engines
    if language:
        params["language"] = language
    if time_range:
        params["time_range"] = time_range
    
    # Safe search: 0=None, 1=Moderate, 2=Strict
    if safesearch is not None:
        params["safesearch"] = str(safesearch)

    print(f"--- Request Info ---")
    print(f"URL: {url}")
    print(f"Params: {json.dumps(params, indent=2)}")
    print("--------------------")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                print(f"Response Status: {response.status}")
                
                if response.status != 200:
                    text = await response.text()
                    print(f"Error Body: {text}")
                    return

                try:
                    data = await response.json()
                except Exception as e:
                    print(f"Failed to parse JSON response: {e}")
                    text = await response.text()
                    print(f"Raw body start: {text[:500]}...")
                    return

                if dump_json:
                    print("Full JSON Response ---")
                    print(json.dumps(data, indent=2))
                
                # Check for direct results or standard list
                results = data.get("results", [])
                
                if not results:
                    print("No results found.")
                    if not dump_json:
                         print("(Use --dump to see the full response structure)")
                else:
                    print(f"Results (Showing top {max_results} of {len(results)}) ---")
                    for i, r in enumerate(results[:max_results]):
                        print(f"[{i+1}] {r.get('title', 'No Title')}")
                        print(f"    URL: {r.get('url', 'No URL')}")
                        print(f"    Engine: {r.get('engine', 'unknown')}")
                        print(f"    Score: {r.get('score', 'N/A')}")
                        
                        # Handle content/snippet variations
                        snippet = r.get('content') or r.get('snippet') or ""
                        # Truncate snippet for display if too long
                        if len(snippet) > 200:
                            snippet = snippet[:197] + "..."
                        print(f"    Snippet: {snippet.strip()}")
                        print("-" * 40)
                        
                # Print any "unresponsive_engines" if present, useful for debugging
                unresponsive = data.get("unresponsive_engines", [])
                if unresponsive:
                    print(f"[WARNING] Unresponsive Engines: {unresponsive}")

    except aiohttp.ClientConnectorError as e:
        print(f"Connection Error: {e}")
        print(f"Is SearXNG running at {base_url}?")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

def main():
    parser = argparse.ArgumentParser(description="Test client for SearXNG optimization")
    
    parser.add_argument("query", help="Search query")
    parser.add_argument("--url", default="http://localhost:5080", help="SearXNG base URL (default: http://localhost:5080)")
    parser.add_argument("--limit", type=int, default=5, help="Max results to display")
    parser.add_argument("--categories", help="Comma-separated categories (e.g., general,science,it)")
    parser.add_argument("--engines", help="Comma-separated engines (e.g., google,bing,duckduckgo)")
    parser.add_argument("--lang", default="auto", help="Language code (e.g., en-US)")
    parser.add_argument("--time", choices=["day", "week", "month", "year"], help="Time range")
    parser.add_argument("--safe", type=int, choices=[0, 1, 2], default=0, help="Safe search (0=None, 1=Moderate, 2=Strict)")
    parser.add_argument("--dump", action="store_true", help="Dump full JSON response")

    args = parser.parse_args()

    asyncio.run(search_searxng(
        query=args.query,
        base_url=args.url,
        max_results=args.limit,
        categories=args.categories,
        engines=args.engines,
        language=args.lang,
        time_range=args.time,
        safesearch=args.safe,
        dump_json=args.dump
    ))

if __name__ == "__main__":
    main()
