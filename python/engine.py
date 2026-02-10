import json
import logging
import os
from collections import defaultdict
from pathlib import Path
from typing import AsyncGenerator, List
from dotenv import load_dotenv, set_key

# Configure logging
logger = logging.getLogger("lightbot.engine")

# Config paths
PROJECT_ROOT = Path(__file__).parent.parent  # python/ -> project root
DEV_ENV_FILE = PROJECT_ROOT / ".env"

USER_CONFIG_DIR = Path.home() / ".lightbot"
USER_ENV_FILE = USER_CONFIG_DIR / ".env"

# Determine which env file to use
# If project root .env exists (development), use it exclusively
# Otherwise use user home .env (production/bundled app)
if DEV_ENV_FILE.exists():
    ENV_FILE_PATH = DEV_ENV_FILE
    print(f"[LightBot] Development mode: using {ENV_FILE_PATH}")
else:
    # Ensure user config directory exists
    USER_CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    # Create default .env if it doesn't exist
    if not USER_ENV_FILE.exists():
        default_content = """# LightBot Configuration
# Restart app after editing this file

# LLM Configuration
# JSON array of model configurations: [{"name": "...", "url": "...", "key": "..."}]
LLM_MODELS=[]
# Index (0-based) of the currently selected model
LLM_MODEL_INDEX=0
# JSON array of fast model configurations for query rewriting
LLM_FAST_MODELS=[]
# Index (0-based) of the currently selected fast model
LLM_FAST_MODEL_INDEX=0
LLM_SYSTEM_PROMPT=You are a helpful AI assistant with web search capabilities.

# Search Configuration
SEARCH_PROVIDER=ddgs
SEARCH_URL=

# UI Configuration
# Hotkey format: Command+Shift+O, Ctrl+Alt+Space, etc.
# Restart app to apply changes
GLOBAL_HOTKEY=Command+Shift+O
"""
        USER_ENV_FILE.write_text(default_content)
        print(f"[LightBot] Created default config at {USER_ENV_FILE}")

    ENV_FILE_PATH = USER_ENV_FILE
    print(f"[LightBot] Production mode: using {ENV_FILE_PATH}")

# Load the determined env file
load_dotenv(ENV_FILE_PATH, override=True)

from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.llms.openai_like import OpenAILike

from tools.search import SearchTool
from tools.query_rewrite import QueryRewriter
from prompts import (
    DEFAULT_SYSTEM_PROMPT,
    SEARCH_RESULTS_SYSTEM_PROMPT,
)


class ChatEngine:
    """Main chat engine with ephemeral memory."""

    def __init__(self):
        # Reload env file to pick up any external changes
        load_dotenv(ENV_FILE_PATH, override=True)

        # Load model configurations from JSON arrays
        self.models: list[dict] = self._load_models_config("LLM_MODELS")
        self.fast_models: list[dict] = self._load_models_config("LLM_FAST_MODELS")

        # Load selected model indices
        try:
            self.model_index: int = int(os.getenv("LLM_MODEL_INDEX", "0"))
        except ValueError:
            self.model_index = 0

        try:
            self.fast_model_index: int = int(os.getenv("LLM_FAST_MODEL_INDEX", "0"))
        except ValueError:
            self.fast_model_index = 0

        # Ensure indices are valid
        if self.model_index >= len(self.models):
            self.model_index = 0
        if self.fast_model_index >= len(self.fast_models):
            self.fast_model_index = 0

        # Current active model configuration
        self.model: str = (
            self.models[self.model_index].get("name", "") if self.models else ""
        )
        self.base_url: str = (
            self.models[self.model_index].get("url", "") if self.models else ""
        )
        self.api_key: str = (
            self.models[self.model_index].get("key", "").strip() if self.models else ""
        )

        # Fast model configuration
        self.fast_model: str = (
            self.fast_models[self.fast_model_index].get("name", "")
            if self.fast_models
            else ""
        )
        self.fast_base_url: str = (
            self.fast_models[self.fast_model_index].get("url", "")
            if self.fast_models
            else ""
        )
        self.fast_api_key: str = (
            self.fast_models[self.fast_model_index].get("key", "").strip()
            if self.fast_models
            else ""
        )

        self.system_prompt: str = os.getenv(
            "LLM_SYSTEM_PROMPT", self._default_system_prompt()
        )

        # Search settings
        self.search_provider: str = os.getenv("SEARCH_PROVIDER", "ddgs")
        self.search_url: str = os.getenv("SEARCH_URL", "")

        # Ephemeral memory: session_id -> list of messages
        self._memory: dict[str, list[ChatMessage]] = defaultdict(list)

        # Search tool - initialized with env settings
        self.search_tool = SearchTool(
            provider=self.search_provider, base_url=self.search_url or None
        )

        # Query rewriter - initialized with env settings
        self.query_rewriter = QueryRewriter(provider=self.search_provider)

        # Initialize LLMs
        self.llm = None
        self.fast_llm = None
        self._log_settings()
        self._init_llms()

    def _load_models_config(self, env_var: str) -> list[dict]:
        """Load model configurations from JSON environment variable."""
        json_str = os.getenv(env_var, "")
        if not json_str:
            return []
        try:
            models = json.loads(json_str)
            if isinstance(models, list):
                # Filter out empty configs
                return [m for m in models if m.get("name", "").strip()]
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse {env_var} as JSON")
        return []

    def _log_settings(self):
        """Log current configuration settings (masking API key)."""
        logger.info("=== LightBot Engine Configuration ===")
        if self.models:
            logger.info(f"Models Configured: {len(self.models)}")
            for i, m in enumerate(self.models):
                marker = "* " if i == self.model_index else "  "
                logger.info(
                    f"  {marker}{m.get('name', 'unnamed')} @ {m.get('url', 'no-url')}"
                )
        if self.fast_models:
            logger.info(f"Fast Models: {len(self.fast_models)}")
            for i, m in enumerate(self.fast_models):
                marker = "* " if i == self.fast_model_index else "  "
                logger.info(
                    f"  {marker}{m.get('name', 'unnamed')} @ {m.get('url', 'no-url')}"
                )
        logger.info(f"Search Provider: {self.search_provider}")
        logger.info(f"Search URL:      {self.search_url or 'N/A'}")

        logger.info(f"System Prompt:   {self.system_prompt[:50]}...")
        logger.info("======================================")

    def _default_system_prompt(self) -> str:
        return DEFAULT_SYSTEM_PROMPT

    def _init_llms(self):
        """Initialize both primary and fast LLMs using OpenAI-compatible interface."""
        # Skip initialization if critical settings are missing
        if not self.base_url or not self.model:
            logger.warning("LLM not initialized: base_url or model not configured")
            self.llm = None
            self.fast_llm = None
            return

        api_key = self.api_key or "dummy-key"
        try:
            self.llm = OpenAILike(
                model=self.model,
                api_key=api_key,
                api_base=self.base_url,
                is_chat_model=True,
                timeout=60.0,
            )
            # Use fast model's own config, fallback to primary model's config
            fast_api_key = self.fast_api_key or api_key
            fast_base_url = self.fast_base_url or self.base_url
            fast_model_name = self.fast_model or self.model
            self.fast_llm = OpenAILike(
                model=fast_model_name,
                api_key=fast_api_key,
                api_base=fast_base_url,
                is_chat_model=True,
                timeout=30.0,
            )
            logger.info("LLM initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize LLM: {e}")
            self.llm = None
            self.fast_llm = None

    async def _rewrite_query(
        self, message: str, history: List[ChatMessage]
    ) -> tuple[str, dict]:
        """Rewrite the user query using conversation history for better search results."""
        if not self.fast_llm:
            logger.warning("Query rewrite skipped: fast_llm not configured")
            return message, {}

        try:
            result = await self.query_rewriter.rewrite(message, history, self.fast_llm)
            standalone_query = result["query"]
            params = result["params"]

            if params:
                logger.info(f"[DEBUG] Rewrite params: {params}")

            return standalone_query, params
        except Exception as e:
            logger.error(f"Error rewriting query: {e}")
            return message, {}

    async def _get_search_context(
        self, query: str, search_params: dict | None = None
    ) -> str:
        """Perform search and format results as context."""
        logger.info(
            f"[EVENT] Web search started via {self.search_tool.display_name}: {query}"
        )
        params = search_params or {}
        results = await self.search_tool.search(query, **params)
        logger.info(f"[EVENT] Web search completed: {len(results)} results")
        if not results:
            return "No search results found."

        context_lines = []
        for i, r in enumerate(results, 1):
            if "error" in r:
                continue
            line = f"[{i}] {r['title']}\nURL: {r['url']}\nSnippet: {r['snippet']}\n"
            context_lines.append(line)

        context = (
            "\n".join(context_lines) if context_lines else "No valid search results."
        )
        # logger.info(f"[DEBUG] Search context sent to LLM:\n{context}")
        return context

    async def chat(
        self, message: str, session_id: str | None = None, search_mode: str = "off"
    ) -> str:
        """Send a message and get a response."""
        if not self.llm:
            return (
                "Error: LLM not configured. Please set Base URL and Model in Settings."
            )

        sid = session_id or "default"
        history = self._memory[sid]

        current_message = message
        system_p = self.system_prompt

        # Handle Search Mode
        if search_mode == "on" or (search_mode == "auto" and False):  # Auto deferred
            standalone_query, search_params = await self._rewrite_query(
                message, history
            )
            search_context = await self._get_search_context(
                standalone_query, search_params
            )
            system_p = SEARCH_RESULTS_SYSTEM_PROMPT.format(search_results=search_context)

        # Build messages
        messages = [ChatMessage(role=MessageRole.SYSTEM, content=system_p)]
        messages.extend(history)
        messages.append(ChatMessage(role=MessageRole.USER, content=current_message))

        # Get response
        logger.info("[EVENT] LLM API call started")
        response = await self.llm.achat(messages)
        logger.info("[EVENT] LLM API call completed")
        content = response.message.content or ""

        # Store in memory
        self._memory[sid].append(ChatMessage(role=MessageRole.USER, content=message))
        self._memory[sid].append(
            ChatMessage(role=MessageRole.ASSISTANT, content=content)
        )

        return content

    async def chat_stream(
        self, message: str, session_id: str | None = None, search_mode: str = "off"
    ) -> AsyncGenerator[str, None]:
        """Send a message and get a streaming response."""
        if not self.llm:
            yield "Error: LLM not configured. Please set Base URL and Model in Settings."
            return

        sid = session_id or "default"
        history = self._memory[sid]

        current_message = message
        system_p = self.system_prompt

        # Handle Search Mode
        logger.info(f"[EVENT] Chat request received - search_mode={search_mode}")
        if search_mode == "on" or (search_mode == "auto" and False):  # Auto deferred
            logger.info("[EVENT] Search mode enabled, starting search flow")
            standalone_query, search_params = await self._rewrite_query(
                message, history
            )
            search_context = await self._get_search_context(
                standalone_query, search_params
            )
            system_p = SEARCH_RESULTS_SYSTEM_PROMPT.format(search_results=search_context)
            yield f"🔍 Search {self.search_tool.display_name} for: {standalone_query}...\n\n"

        # Build messages
        messages = [ChatMessage(role=MessageRole.SYSTEM, content=system_p)]
        messages.extend(history)
        messages.append(ChatMessage(role=MessageRole.USER, content=current_message))

        full_response = []
        logger.info("[EVENT] LLM API call started (streaming)")
        stream = await self.llm.astream_chat(messages)
        async for chunk in stream:
            content = chunk.delta or ""
            full_response.append(content)
            yield content
        logger.info("[EVENT] LLM API call completed (streaming)")

        # Store in memory after streaming completes
        self._memory[sid].append(ChatMessage(role=MessageRole.USER, content=message))
        self._memory[sid].append(
            ChatMessage(role=MessageRole.ASSISTANT, content="".join(full_response))
        )

    def clear_memory(self, session_id: str | None = None):
        """Clear chat memory for a session or all sessions."""
        if session_id:
            self._memory.pop(session_id, None)
        else:
            self._memory.clear()

    def get_settings(self) -> dict:
        """Get current engine settings."""
        # Reload to pick up any external changes
        load_dotenv(ENV_FILE_PATH, override=True)
        # Reload model configs to pick up external changes
        self.models = self._load_models_config("LLM_MODELS")
        self.fast_models = self._load_models_config("LLM_FAST_MODELS")
        return {
            "models": self.models,
            "model_index": self.model_index,
            "fast_models": self.fast_models,
            "fast_model_index": self.fast_model_index,
            "system_prompt": self.system_prompt,
            "search_provider": self.search_provider,
            "search_url": self.search_url,
            "hotkey": os.getenv("GLOBAL_HOTKEY", "Command+Shift+O"),
        }

    def update_settings(self, settings: dict):
        """Update engine settings, save to .env file, and reinitialize LLMs if needed."""
        reinitialize = False

        if "models" in settings:
            self.models = [m for m in settings["models"] if m.get("name", "").strip()]
            set_key(ENV_FILE_PATH, "LLM_MODELS", json.dumps(self.models))
            # Ensure model_index stays valid
            if self.model_index >= len(self.models):
                self.model_index = 0
            if self.models:
                self.model = self.models[self.model_index].get("name", "")
                self.base_url = self.models[self.model_index].get("url", "")
                self.api_key = self.models[self.model_index].get("key", "").strip()
            reinitialize = True

        if "model_index" in settings:
            new_index = settings["model_index"]
            if isinstance(new_index, int) and 0 <= new_index < len(self.models):
                self.model_index = new_index
                set_key(ENV_FILE_PATH, "LLM_MODEL_INDEX", str(self.model_index))
                self.model = self.models[self.model_index].get("name", "")
                self.base_url = self.models[self.model_index].get("url", "")
                self.api_key = self.models[self.model_index].get("key", "").strip()
                reinitialize = True

        if "fast_models" in settings:
            self.fast_models = [
                m for m in settings["fast_models"] if m.get("name", "").strip()
            ]
            set_key(ENV_FILE_PATH, "LLM_FAST_MODELS", json.dumps(self.fast_models))
            # Ensure fast_model_index stays valid
            if self.fast_model_index >= len(self.fast_models):
                self.fast_model_index = 0
            if self.fast_models:
                self.fast_model = self.fast_models[self.fast_model_index].get(
                    "name", ""
                )
                self.fast_base_url = self.fast_models[self.fast_model_index].get(
                    "url", ""
                )
                self.fast_api_key = (
                    self.fast_models[self.fast_model_index].get("key", "").strip()
                )
            reinitialize = True

        if "fast_model_index" in settings:
            new_index = settings["fast_model_index"]
            if isinstance(new_index, int) and 0 <= new_index < len(self.fast_models):
                self.fast_model_index = new_index
                set_key(
                    ENV_FILE_PATH, "LLM_FAST_MODEL_INDEX", str(self.fast_model_index)
                )
                self.fast_model = self.fast_models[self.fast_model_index].get(
                    "name", ""
                )
                self.fast_base_url = self.fast_models[self.fast_model_index].get(
                    "url", ""
                )
                self.fast_api_key = (
                    self.fast_models[self.fast_model_index].get("key", "").strip()
                )
                reinitialize = True

        if "system_prompt" in settings:
            self.system_prompt = settings["system_prompt"]
            set_key(ENV_FILE_PATH, "LLM_SYSTEM_PROMPT", self.system_prompt)

        if "search_provider" in settings:
            self.search_provider = settings["search_provider"]
            set_key(ENV_FILE_PATH, "SEARCH_PROVIDER", self.search_provider)
            self.search_tool.update_settings(provider=settings["search_provider"])
            self.query_rewriter.provider = settings["search_provider"]

        if "search_url" in settings:
            self.search_url = settings["search_url"]
            set_key(ENV_FILE_PATH, "SEARCH_URL", self.search_url)
            self.search_tool.update_settings(base_url=settings["search_url"])

        if "hotkey" in settings:
            set_key(ENV_FILE_PATH, "GLOBAL_HOTKEY", settings["hotkey"])

        logger.info(f"Settings saved to {ENV_FILE_PATH}")

        if reinitialize:
            self._init_llms()
        self._log_settings()
