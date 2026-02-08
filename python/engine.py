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
# Comma-separated list of available models
LLM_MODELS=
# Index (0-based) of the currently selected model from LLM_MODELS
LLM_MODEL_INDEX=0
LLM_BASE_URL=
LLM_API_KEY=
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
from prompts import CONDENSE_QUESTION_PROMPT, SEARCH_ANSWER_PROMPT


class ChatEngine:
    """Main chat engine with ephemeral memory."""

    def __init__(self):
        # Reload env file to pick up any external changes
        load_dotenv(ENV_FILE_PATH, override=True)

        # Load available models from LLM_MODELS (comma-separated list)
        models_str = os.getenv("LLM_MODELS", "")
        self.available_models: list[str] = [
            m.strip() for m in models_str.split(",") if m.strip()
        ]

        # Load selected model index
        try:
            self.model_index: int = int(os.getenv("LLM_MODEL_INDEX", "0"))
        except ValueError:
            self.model_index = 0

        # Ensure index is valid
        if not self.available_models:
            self.model_index = 0
        elif self.model_index >= len(self.available_models):
            self.model_index = 0

        # Current active model from the list
        self.model: str = (
            self.available_models[self.model_index] if self.available_models else ""
        )
        self.fast_model: str = os.getenv("LLM_FAST_MODEL", "")
        self.base_url: str = os.getenv("LLM_BASE_URL", "")
        self.api_key: str = os.getenv("LLM_API_KEY", "").strip()
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

    def _log_settings(self):
        """Log current configuration settings (masking API key)."""
        logger.info("=== LightBot Engine Configuration ===")
        if self.available_models:
            models_display = ", ".join(
                [
                    f"* {m}" if i == self.model_index else m
                    for i, m in enumerate(self.available_models)
                ]
            )
            logger.info(f"Available Models: {models_display}")
        logger.info(f"Selected Model:  {self.model} (index: {self.model_index})")
        logger.info(f"Fast Model:      {self.fast_model}")
        logger.info(f"API Base URL:    {self.base_url}")
        logger.info(f"Search Provider: {self.search_provider}")
        logger.info(f"Search URL:      {self.search_url or 'N/A'}")

        # Mask API key for security
        if self.api_key:
            masked_key = (
                f"{self.api_key[:4]}...{self.api_key[-4:]}"
                if len(self.api_key) > 8
                else "****"
            )
            logger.info(f"API Key:         {masked_key}")
        else:
            logger.info("API Key:         Not Set (using dummy-key)")

        logger.info(f"System Prompt:   {self.system_prompt[:50]}...")
        logger.info("======================================")

    def _default_system_prompt(self) -> str:
        return (
            "You are a helpful AI assistant with web search capabilities. "
            "You provide concise, accurate answers. "
            "When you need current information, you can search the web."
        )

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
            self.fast_llm = OpenAILike(
                model=self.fast_model or self.model,
                api_key=api_key,
                api_base=self.base_url,
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
            system_p = SEARCH_ANSWER_PROMPT.format(search_results=search_context)

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
            system_p = SEARCH_ANSWER_PROMPT.format(search_results=search_context)
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
        return {
            "available_models": self.available_models,
            "model_index": self.model_index,
            "fast_model": self.fast_model,
            "base_url": self.base_url,
            "api_key": self.api_key,
            "system_prompt": self.system_prompt,
            "search_provider": self.search_provider,
            "search_url": self.search_url,
            "hotkey": os.getenv("GLOBAL_HOTKEY", "Command+Shift+O"),
        }

    def update_settings(self, settings: dict):
        """Update engine settings, save to .env file, and reinitialize LLMs if needed."""
        reinitialize = False

        if "available_models" in settings:
            self.available_models = settings["available_models"]
            models_str = ",".join(self.available_models)
            set_key(ENV_FILE_PATH, "LLM_MODELS", models_str)
            # Ensure model_index stays valid
            if self.model_index >= len(self.available_models):
                self.model_index = 0
            if self.available_models:
                self.model = self.available_models[self.model_index]
            reinitialize = True
        if "model_index" in settings:
            new_index = settings["model_index"]
            if isinstance(new_index, int) and 0 <= new_index < len(
                self.available_models
            ):
                self.model_index = new_index
                set_key(ENV_FILE_PATH, "LLM_MODEL_INDEX", str(self.model_index))
                self.model = self.available_models[self.model_index]
                reinitialize = True
        if "fast_model" in settings:
            self.fast_model = settings["fast_model"]
            set_key(ENV_FILE_PATH, "LLM_FAST_MODEL", self.fast_model)
            reinitialize = True
        if "base_url" in settings:
            self.base_url = settings["base_url"]
            set_key(ENV_FILE_PATH, "LLM_BASE_URL", self.base_url)
            reinitialize = True
        if "api_key" in settings:
            self.api_key = settings["api_key"]
            set_key(ENV_FILE_PATH, "LLM_API_KEY", self.api_key)
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
