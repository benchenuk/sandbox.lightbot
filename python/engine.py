"""
Chat Engine - Core AI logic using LlamaIndex
Supports both Local (Ollama) and Remote (OpenAI) LLMs.
"""

from collections import defaultdict
from typing import AsyncGenerator

from llama_index.core import Settings
from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.llms.ollama import Ollama
from llama_index.llms.openai import OpenAI

from tools.search import SearchTool


class ChatEngine:
    """Main chat engine with ephemeral memory."""
    
    def __init__(self):
        self.provider: str = "ollama"  # "ollama" or "openai"
        self.model: str = "llama3.2"
        self.base_url: str | None = None
        self.api_key: str | None = None
        self.system_prompt: str = self._default_system_prompt()
        
        # Ephemeral memory: session_id -> list of messages
        self._memory: dict[str, list[ChatMessage]] = defaultdict(list)
        
        # Search tool
        self.search_tool = SearchTool()
        
        # Initialize LLM
        self._init_llm()
    
    def _default_system_prompt(self) -> str:
        return (
            "You are LightBot, a helpful AI assistant with web search capabilities. "
            "You provide concise, accurate answers. "
            "When you need current information, you can search the web."
        )
    
    def _init_llm(self):
        """Initialize the LLM based on current settings."""
        if self.provider == "ollama":
            base_url = self.base_url or "http://localhost:11434"
            Settings.llm = Ollama(model=self.model, base_url=base_url)
        elif self.provider == "openai":
            api_key = self.api_key or "dummy-key"
            base_url = self.base_url or None
            Settings.llm = OpenAI(
                model=self.model,
                api_key=api_key,
                base_url=base_url
            )
    
    async def chat(self, message: str, session_id: str | None = None) -> str:
        """Send a message and get a response."""
        sid = session_id or "default"
        
        # Build conversation history
        messages = self._build_messages(sid, message)
        
        # Get response from LLM
        llm = Settings.llm
        response = await llm.achat(messages)
        
        # Store in memory
        self._memory[sid].append(ChatMessage(role=MessageRole.USER, content=message))
        self._memory[sid].append(
            ChatMessage(role=MessageRole.ASSISTANT, content=response.message.content)
        )
        
        return response.message.content
    
    async def chat_stream(
        self, message: str, session_id: str | None = None
    ) -> AsyncGenerator[str, None]:
        """Send a message and get a streaming response."""
        sid = session_id or "default"
        
        # Build conversation history
        messages = self._build_messages(sid, message)
        
        # Stream response from LLM
        llm = Settings.llm
        full_response = []
        
        async for chunk in llm.astream_chat(messages):
            content = chunk.delta or ""
            full_response.append(content)
            yield content
        
        # Store in memory after streaming completes
        self._memory[sid].append(ChatMessage(role=MessageRole.USER, content=message))
        self._memory[sid].append(
            ChatMessage(role=MessageRole.ASSISTANT, content="".join(full_response))
        )
    
    def _build_messages(
        self, session_id: str, new_message: str
    ) -> list[ChatMessage]:
        """Build the message list including system prompt and history."""
        messages = [ChatMessage(role=MessageRole.SYSTEM, content=self.system_prompt)]
        messages.extend(self._memory[session_id])
        messages.append(ChatMessage(role=MessageRole.USER, content=new_message))
        return messages
    
    def clear_memory(self, session_id: str | None = None):
        """Clear chat memory for a session or all sessions."""
        if session_id:
            self._memory.pop(session_id, None)
        else:
            self._memory.clear()
    
    def get_settings(self) -> dict:
        """Get current engine settings."""
        return {
            "provider": self.provider,
            "model": self.model,
            "base_url": self.base_url,
            "system_prompt": self.system_prompt,
        }
    
    def update_settings(self, settings: dict):
        """Update engine settings and reinitialize LLM if needed."""
        if "provider" in settings:
            self.provider = settings["provider"]
        if "model" in settings:
            self.model = settings["model"]
        if "base_url" in settings:
            self.base_url = settings["base_url"]
        if "api_key" in settings:
            self.api_key = settings["api_key"]
        if "system_prompt" in settings:
            self.system_prompt = settings["system_prompt"]
        
        # Reinitialize LLM with new settings
        self._init_llm()
