#!/usr/bin/env python3
"""
LightBot Python Sidecar - FastAPI Server
Provides AI chat and web search capabilities to the Tauri frontend.
"""

import argparse
import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from dotenv import load_dotenv

# Add current directory to sys.path for local imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables from .env file
# Try both the current directory and the parent directory
load_dotenv()  # In current dir (python/.env)
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")) # In project root

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from engine import ChatEngine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("lightbot.server")

# Global chat engine instance
chat_engine: ChatEngine | None = None


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    search_mode: str = "off"  # "off", "on", "auto"


class ChatResponse(BaseModel):
    response: str


class HealthResponse(BaseModel):
    status: str
    version: str = "1.1.6"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Manage application lifecycle."""
    global chat_engine
    # Startup
    logger.info("Starting LightBot Python Sidecar...")
    chat_engine = ChatEngine()
    yield
    # Shutdown
    logger.info("Shutting down LightBot Python Sidecar...")
    if chat_engine:
        chat_engine.clear_memory()


app = FastAPI(
    title="LightBot Sidecar",
    description="AI Chat and Web Search API for LightBot",
    version="1.1.6",
    lifespan=lifespan,
)

# Enable CORS for communication with Tauri frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to tauri://localhost
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(status="healthy")


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """Non-streaming chat endpoint."""
    global chat_engine
    if not chat_engine:
        return ChatResponse(response="Error: Chat engine not initialized")
    
    response = await chat_engine.chat(request.message, request.session_id, request.search_mode)
    return ChatResponse(response=response)


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    """Streaming chat endpoint."""
    global chat_engine
    if not chat_engine:
        return StreamingResponse(
            iter(["Error: Chat engine not initialized"]),
            media_type="text/plain"
        )
    
    async def generate() -> AsyncGenerator[str, None]:
        async for chunk in chat_engine.chat_stream(request.message, request.session_id, request.search_mode):
            yield chunk
    
    return StreamingResponse(generate(), media_type="text/plain")


@app.post("/chat/clear")
async def clear_chat(session_id: str | None = None) -> dict:
    """Clear chat memory for a session."""
    global chat_engine
    if chat_engine:
        chat_engine.clear_memory(session_id)
    return {"status": "cleared"}


@app.get("/settings")
async def get_settings() -> dict:
    """Get current settings."""
    global chat_engine
    if chat_engine:
        return chat_engine.get_settings()
    return {}


@app.post("/settings")
async def update_settings(settings: dict) -> dict:
    """Update settings."""
    global chat_engine
    if chat_engine:
        chat_engine.update_settings(settings)
        return {"status": "updated"}
    return {"status": "error", "message": "Engine not initialized"}


def main():
    parser = argparse.ArgumentParser(description="LightBot Python Sidecar")
    parser.add_argument("--port", type=int, default=8080, help="Port to run on")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to bind to")
    args = parser.parse_args()
    
    import uvicorn
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
