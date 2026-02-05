import logging
import os
from collections import defaultdict
from typing import AsyncGenerator, List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger("lightbot.engine")

from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.llms.openai_like import OpenAILike

from tools.search import SearchTool
from prompts import CONDENSE_QUESTION_PROMPT, SEARCH_ANSWER_PROMPT


class ChatEngine:
    """Main chat engine with ephemeral memory."""
    
    def __init__(self):
        # Load settings from env or defaults
        self.model: str = os.getenv("LLM_MODEL", "gpt-4o")
        self.fast_model: str = os.getenv("LLM_FAST_MODEL", self.model)
        self.base_url: str | None = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
        self.api_key: str | None = os.getenv("LLM_API_KEY", None)
        self.system_prompt: str = self._default_system_prompt()
        
        # Ephemeral memory: session_id -> list of messages
        self._memory: dict[str, list[ChatMessage]] = defaultdict(list)
        
        # Search tool
        self.search_tool = SearchTool()
        
        # Initialize LLMs
        self.llm = None
        self.fast_llm = None
        self._init_llms()
    
    def _default_system_prompt(self) -> str:
        return (
            "You are LightBot, a helpful AI assistant with web search capabilities. "
            "You provide concise, accurate answers. "
            "When you need current information, you can search the web."
        )
    
    def _init_llms(self):
        """Initialize both primary and fast LLMs using OpenAI-compatible interface."""
        api_key = self.api_key or "dummy-key"
        self.llm = OpenAILike(
            model=self.model, 
            api_key=api_key, 
            api_base=self.base_url,
            is_chat_model=True,
            timeout=60.0
        )
        self.fast_llm = OpenAILike(
            model=self.fast_model, 
            api_key=api_key, 
            api_base=self.base_url,
            is_chat_model=True,
            timeout=30.0
        )

    
    async def _rewrite_query(self, message: str, history: List[ChatMessage]) -> str:
        """Rewrite the user query using conversation history for better search results."""
        if not history:
            return message
        
        logger.info("[EVENT] Query rewrite started")
        # Format history for prompt
        history_str = "\n".join([f"{m.role.value}: {m.content}" for m in history])
        prompt = CONDENSE_QUESTION_PROMPT.format(
            chat_history=history_str, 
            question=message
        )
        
        try:
            response = await self.fast_llm.acomplete(prompt)
            standalone_query = response.text.strip()
            logger.info("[EVENT] Query rewrite completed")
            # If the model fails or returns empty, fallback to original
            return standalone_query if standalone_query else message
        except Exception as e:
            logger.error(f"Error rewriting query: {e}")
            return message

    async def _get_search_context(self, query: str) -> str:
        """Perform search and format results as context."""
        logger.info("[EVENT] Web search started")
        results = await self.search_tool.search(query)
        logger.info(f"[EVENT] Web search completed: {len(results)} results")
        if not results:
            return "No search results found."
        
        context_lines = []
        for i, r in enumerate(results, 1):
            if "error" in r:
                continue
            line = f"[{i}] {r['title']}\nURL: {r['url']}\nSnippet: {r['snippet']}\n"
            context_lines.append(line)
        
        return "\n".join(context_lines) if context_lines else "No valid search results."

    async def chat(self, message: str, session_id: str | None = None, search_mode: str = "off") -> str:
        """Send a message and get a response."""
        sid = session_id or "default"
        history = self._memory[sid]
        
        current_message = message
        system_p = self.system_prompt

        # Handle Search Mode
        if search_mode == "on" or (search_mode == "auto" and False): # Auto deferred
            standalone_query = await self._rewrite_query(message, history)
            search_context = await self._get_search_context(standalone_query)
            system_p = SEARCH_ANSWER_PROMPT.format(search_results=search_context)
        
        # Build messages
        messages = [ChatMessage(role=MessageRole.SYSTEM, content=system_p)]
        messages.extend(history)
        messages.append(ChatMessage(role=MessageRole.USER, content=current_message))
        
        # Get response
        logger.info("[EVENT] LLM API call started")
        response = await self.llm.achat(messages)
        logger.info("[EVENT] LLM API call completed")
        content = response.message.content
        
        # Store in memory
        self._memory[sid].append(ChatMessage(role=MessageRole.USER, content=message))
        self._memory[sid].append(ChatMessage(role=MessageRole.ASSISTANT, content=content))
        
        return content
    
    async def chat_stream(
        self, message: str, session_id: str | None = None, search_mode: str = "off"
    ) -> AsyncGenerator[str, None]:
        """Send a message and get a streaming response."""
        sid = session_id or "default"
        history = self._memory[sid]
        
        current_message = message
        system_p = self.system_prompt

        # Handle Search Mode
        logger.info(f"[EVENT] Chat request received - search_mode={search_mode}")
        if search_mode == "on" or (search_mode == "auto" and False): # Auto deferred
            logger.info("[EVENT] Search mode enabled, starting search flow")
            standalone_query = await self._rewrite_query(message, history)
            search_context = await self._get_search_context(standalone_query)
            system_p = SEARCH_ANSWER_PROMPT.format(search_results=search_context)
            yield f"🔍 Searching for: {standalone_query}...\n\n"
        
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
        return {
            "model": self.model,
            "fast_model": self.fast_model,
            "base_url": self.base_url,
            "system_prompt": self.system_prompt,
        }
    
    def update_settings(self, settings: dict):
        """Update engine settings and reinitialize LLMs if needed."""
        if "model" in settings:
            self.model = settings["model"]
        if "fast_model" in settings:
            self.fast_model = settings["fast_model"]
        if "base_url" in settings:
            self.base_url = settings["base_url"]
        if "api_key" in settings:
            self.api_key = settings["api_key"]
        if "system_prompt" in settings:
            self.system_prompt = settings["system_prompt"]
        
        self._init_llms()


