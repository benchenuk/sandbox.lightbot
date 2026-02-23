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
from pathlib import Path
from typing import AsyncGenerator

from dotenv import load_dotenv

# Handle PyInstaller bundled data - add bundle directory to path
if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    sys.path.insert(0, sys._MEIPASS)

# Load environment variables from .env file
# Try both the current directory and the parent directory
load_dotenv()  # In current dir (python/.env)
load_dotenv(
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
)  # In project root

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Import engine with error handling
try:
    from engine import ChatEngine

    print("[SERVER] ChatEngine imported successfully", flush=True)
except Exception as e:
    print(f"[SERVER] FAILED to import ChatEngine: {e}", flush=True)
    import traceback

    print(traceback.format_exc(), flush=True)
    raise

# Configure logging - both to stdout and file
log_dir = Path.home() / ".lightbot"
log_dir.mkdir(parents=True, exist_ok=True)
log_file = log_dir / "lightbot.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, mode="a"),
    ],
)
logger = logging.getLogger("lightbot.server")
logger.info(f"Logging to: {log_file}")

# Global chat engine instance
chat_engine: ChatEngine | None = None
startup_error: str | None = None


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    search_mode: str = "off"  # "off", "on", "auto"


class ChatResponse(BaseModel):
    response: str


class HealthResponse(BaseModel):
    status: str
    version: str = "1.4.1"
    error: str | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Manage application lifecycle."""
    global chat_engine, startup_error
    # Startup
    print("[SERVER] Lifespan starting...", flush=True)
    logger.info("Starting LightBot Python Sidecar...")
    try:
        print("[SERVER] About to create ChatEngine...", flush=True)
        chat_engine = ChatEngine()
        print("[SERVER] ChatEngine created successfully", flush=True)
        logger.info("ChatEngine initialized successfully")
    except Exception as e:
        startup_error = str(e)
        print(f"[SERVER] ERROR: Failed to initialize ChatEngine: {e}", flush=True)
        logger.error(f"Failed to initialize ChatEngine: {e}")
        import traceback

        tb = traceback.format_exc()
        print(tb, flush=True)
        logger.error(tb)
    yield
    # Shutdown
    logger.info("Shutting down LightBot Python Sidecar...")
    print("[SERVER] Shutting down...", flush=True)
    if chat_engine:
        chat_engine.clear_memory()


app = FastAPI(
    title="LightBot Sidecar",
    description="AI Chat and Web Search API for LightBot",
    version="1.4.1",
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
    global startup_error
    if startup_error:
        return HealthResponse(status="error", error=startup_error)
    if not chat_engine:
        return HealthResponse(status="initializing")
    return HealthResponse(status="healthy")


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """Non-streaming chat endpoint."""
    global chat_engine
    if not chat_engine:
        return ChatResponse(response="Error: Chat engine not initialized")

    response = await chat_engine.chat(
        request.message, request.session_id, request.search_mode
    )
    return ChatResponse(response=response)


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    """Streaming chat endpoint."""
    global chat_engine
    if not chat_engine:
        return StreamingResponse(
            iter(["Error: Chat engine not initialized"]), media_type="text/plain"
        )

    async def generate() -> AsyncGenerator[str, None]:
        if chat_engine:
            async for chunk in chat_engine.chat_stream(
                request.message, request.session_id, request.search_mode
            ):
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
