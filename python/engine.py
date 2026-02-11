import logging
import os
import sys
from collections import defaultdict
from pathlib import Path
from typing import AsyncGenerator, List

# Use tomllib for reading (built into Python 3.11+)
import tomllib


# Simple TOML writer - no external dependency
def write_toml(data: dict, file_path: Path) -> None:
    """Write a simple TOML file. Only supports basic nested dicts and lists."""
    lines = []

    def write_value(val, indent=0):
        if isinstance(val, str):
            return f'"{val}"'
        elif isinstance(val, int):
            return str(val)
        elif isinstance(val, bool):
            return "true" if val else "false"
        elif isinstance(val, list):
            return "[" + ", ".join(write_value(v) for v in val) + "]"
        return str(val)

    def write_table(table, table_name=""):
        for key, val in table.items():
            if isinstance(val, dict):
                # Nested table
                full_name = f"{table_name}.{key}" if table_name else key
                lines.append(f"\n[{full_name}]")
                write_table(val, full_name)
            elif isinstance(val, list) and val and isinstance(val[0], dict):
                # Array of tables
                full_name = f"{table_name}.{key}" if table_name else key
                for item in val:
                    lines.append(f"\n[[{full_name}]]")
                    for k, v in item.items():
                        lines.append(f"{k} = {write_value(v)}")
            else:
                lines.append(f"{key} = {write_value(val)}")

    write_table(data)

    with open(file_path, "w") as f:
        f.write("\n".join(lines) + "\n")


# Configure logging
logger = logging.getLogger("lightbot.engine")

# Config paths
PROJECT_ROOT = Path(__file__).parent.parent  # python/ -> project root
DEV_CONFIG_FILE = PROJECT_ROOT / "config.toml"

USER_CONFIG_DIR = Path.home() / ".lightbot"
USER_CONFIG_FILE = USER_CONFIG_DIR / "config.toml"

# Determine which config file to use
# If project root config.toml exists (development), use it exclusively
# Otherwise use user home config.toml (production/bundled app)
if DEV_CONFIG_FILE.exists():
    CONFIG_FILE_PATH = DEV_CONFIG_FILE
else:
    # Ensure user config directory exists
    USER_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE_PATH = USER_CONFIG_FILE

from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.llms.openai_like import OpenAILike

from tools.search import SearchTool
from tools.query_rewrite import QueryRewriter
from prompts import (
    DEFAULT_SYSTEM_PROMPT,
    SEARCH_RESULTS_SYSTEM_PROMPT,
)


class ConfigManager:
    """Manages TOML configuration file."""

    def __init__(self, config_path: Path):
        self.config_path = config_path
        self._ensure_config_exists()

    def _ensure_config_exists(self):
        """Create default config if it doesn't exist."""
        if not self.config_path.exists():
            default_config = {
                "models": {
                    "selected_index": 0,
                    "list": [],
                },
                "fast_models": {
                    "selected_index": 0,
                    "list": [],
                },
                "settings": {
                    "system_prompt": DEFAULT_SYSTEM_PROMPT,
                    "search_provider": "ddgs",
                    "search_url": "",
                    "hotkey": "Command+Shift+O",
                },
            }
            self.save(default_config)
            print(f"[LightBot] Created default config at {self.config_path}")

    def load(self) -> dict:
        """Load configuration from TOML file."""
        if not self.config_path.exists():
            logger.info(
                f"Config file not found at {self.config_path}, creating default"
            )
            self._ensure_config_exists()

        try:
            with open(self.config_path, "rb") as f:
                return tomllib.load(f)
        except Exception as e:
            logger.error(f"Failed to load config from {self.config_path}: {e}")
            # Return default config on error
            return {
                "models": {"selected_index": 0, "list": []},
                "fast_models": {"selected_index": 0, "list": []},
                "settings": {
                    "system_prompt": DEFAULT_SYSTEM_PROMPT,
                    "search_provider": "ddgs",
                    "search_url": "",
                    "hotkey": "Command+Shift+O",
                },
            }

    def save(self, config: dict):
        """Save configuration to TOML file."""
        try:
            write_toml(config, self.config_path)
        except Exception as e:
            logger.error(f"Failed to save config: {e}")


class ChatEngine:
    """Main chat engine with ephemeral memory."""

    def __init__(self):
        # Initialize config manager
        self.config_manager = ConfigManager(CONFIG_FILE_PATH)

        # Load configuration
        config = self.config_manager.load()

        # Load model configurations
        models_config = config.get("models", {})
        self.models: list[dict] = [
            m for m in models_config.get("list", []) if m.get("name", "").strip()
        ]
        self.model_index: int = models_config.get("selected_index", 0)

        fast_models_config = config.get("fast_models", {})
        self.fast_models: list[dict] = [
            m for m in fast_models_config.get("list", []) if m.get("name", "").strip()
        ]
        self.fast_model_index: int = fast_models_config.get("selected_index", 0)

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

        # Settings
        settings = config.get("settings", {})
        self.system_prompt: str = settings.get(
            "system_prompt", self._default_system_prompt()
        )
        self.search_provider: str = settings.get("search_provider", "ddgs")
        self.search_url: str = settings.get("search_url", "")

        # Ephemeral memory: session_id -> list of messages
        self._memory: dict[str, list[ChatMessage]] = defaultdict(list)

        # Search tool - initialized with settings
        self.search_tool = SearchTool(
            provider=self.search_provider, base_url=self.search_url or None
        )

        # Query rewriter - initialized with settings
        self.query_rewriter = QueryRewriter(provider=self.search_provider)

        # Initialize LLMs
        self.llm = None
        self.fast_llm = None
        self._log_settings()
        self._init_llms()

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

            if standalone_query == message:
                logger.info(
                    f"[EVENT] Query not rewritten (using original)"
                )

            if params:
                logger.info(f"[DEBUG] Rewrite params: {params}")

            return standalone_query, params
        except Exception as e:
            logger.error(f"Error rewriting query: {e}")
            import traceback

            logger.error(traceback.format_exc())
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
            system_p = SEARCH_RESULTS_SYSTEM_PROMPT.format(
                search_results=search_context
            )

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
            system_p = SEARCH_RESULTS_SYSTEM_PROMPT.format(
                search_results=search_context
            )
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
        config = self.config_manager.load()

        models_config = config.get("models", {})
        fast_models_config = config.get("fast_models", {})
        settings = config.get("settings", {})

        return {
            "models": models_config.get("list", []),
            "model_index": models_config.get("selected_index", 0),
            "fast_models": fast_models_config.get("list", []),
            "fast_model_index": fast_models_config.get("selected_index", 0),
            "system_prompt": settings.get(
                "system_prompt", self._default_system_prompt()
            ),
            "search_provider": settings.get("search_provider", "ddgs"),
            "search_url": settings.get("search_url", ""),
            "hotkey": settings.get("hotkey", "Command+Shift+O"),
        }

    def update_settings(self, settings: dict):
        """Update engine settings, save to TOML file, and reinitialize LLMs if needed."""
        config = self.config_manager.load()
        reinitialize = False

        if "models" in settings:
            models = [m for m in settings["models"] if m.get("name", "").strip()]
            config["models"]["list"] = models
            self.models = models
            # Ensure model_index stays valid
            if self.model_index >= len(self.models):
                self.model_index = 0
                config["models"]["selected_index"] = 0
            if self.models:
                self.model = self.models[self.model_index].get("name", "")
                self.base_url = self.models[self.model_index].get("url", "")
                self.api_key = self.models[self.model_index].get("key", "").strip()
            reinitialize = True

        if "model_index" in settings:
            new_index = settings["model_index"]
            if isinstance(new_index, int) and 0 <= new_index < len(self.models):
                self.model_index = new_index
                config["models"]["selected_index"] = new_index
                self.model = self.models[self.model_index].get("name", "")
                self.base_url = self.models[self.model_index].get("url", "")
                self.api_key = self.models[self.model_index].get("key", "").strip()
                reinitialize = True

        if "fast_models" in settings:
            fast_models = [
                m for m in settings["fast_models"] if m.get("name", "").strip()
            ]
            config["fast_models"]["list"] = fast_models
            self.fast_models = fast_models
            # Ensure fast_model_index stays valid
            if self.fast_model_index >= len(self.fast_models):
                self.fast_model_index = 0
                config["fast_models"]["selected_index"] = 0
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
                config["fast_models"]["selected_index"] = new_index
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
            config["settings"]["system_prompt"] = settings["system_prompt"]

        if "search_provider" in settings:
            self.search_provider = settings["search_provider"]
            config["settings"]["search_provider"] = settings["search_provider"]
            self.search_tool.update_settings(provider=settings["search_provider"])
            self.query_rewriter.provider = settings["search_provider"]

        if "search_url" in settings:
            self.search_url = settings["search_url"]
            config["settings"]["search_url"] = settings["search_url"]
            self.search_tool.update_settings(base_url=settings["search_url"])

        if "hotkey" in settings:
            config["settings"]["hotkey"] = settings["hotkey"]

        # Save config
        self.config_manager.save(config)
        logger.info(f"Settings saved to {self.config_manager.config_path}")

        if reinitialize:
            self._init_llms()
        self._log_settings()
