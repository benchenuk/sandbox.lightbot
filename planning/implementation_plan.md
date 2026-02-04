# Implementation Plan - Lightweight AI Chat Bot

## Goal Description
Create a native MacOS desktop application for personal AI chat with web search capabilities. The app will be "lightweight" yet powerful, supporting both local (privacy-focused) and remote (high-power) LLMs.

**Key Features:**
- **Platform**: MacOS Desktop (Tauri).
- **Tech Stack**: Tauri (Rust core) + React (UI) + Python (AI Engine).
- **Core AI**: LlamaIndex (for structured retrieval and agentic workflows).
- **Search**: Integrated web search for grounded answers (DDG, SearXNG).
- **Design**: Minimalist, TUI-style aesthetics (Terminal User Interface vibe).
- **Access**: Menubar app with Global Hotkey toggle.
- **Persistence**: Ephemeral (Session-only, no database).

## Proposed Architecture

### 1. Hybrid Architecture (Tauri + Python Sidecar)
We will use the **Sidecar Pattern**.
- **Tauri (Main Process)**: Handles the OS integration, window management, and spawns the Python process.
- **Python (Subprocess)**: Runs a standalone API server (FastAPI).
- **Communication**: HTTP over localhost.
- **Persistence**: In-memory only. Chat history is lost on app exit.

### 2. Technology Choices
- **Frontend**: React + Vite + TailwindCSS (for rapid, beautiful UI development).
- **Backend Framework**: FastAPI (fast, native async support).
- **AI Logic**: LlamaIndex.
    - Why? Excellent abstraction for switching between Local (Ollama) and Remote (OpenAI) unlike raw API calls.
    - **Agentic**: Use `LlamaIndex Workflows` or `ReActAgent` for the search loop.
- **Packaging**: PyInstaller to bundle the Python environment into a single binary included in the Tauri app.

## Proposed Changes

### Phase 1: Skeleton & IPC
#### [NEW] `src-tauri/tauri.conf.json`
- Configure `bundle` targets.
- Define `externalBin` for the Python sidecar.
- Add plugins: `global-shortcut`, `shell`.

#### [NEW] `src-tauri/capabilities/default.json`
- Configure permissions for global shortcuts and system tray.

#### [NEW] `src-tauri/src/main.rs`
- Logic to spawn the sidecar.
- Logic to detect the port and manage the child process lifecycle.
- **System Tray**: Implement tray icon and menu (Show/Hide, Quit).
- **Global Hotkey**: Register hotkey (e.g., `Command+Shift+O`) to toggle window visibility.

#### [NEW] `python/server.py`
- Basic FastAPI application.
- Health check endpoint.
- `/chat` endpoint (streaming response).

### Phase 2: Core AI Engine
#### [NEW] `python/engine.py`
- `ChatEngine` class.
- Support for `Ollama` and `OpenAI` providers via LlamaIndex.

#### [NEW] `python/tools/search.py`
- Web search tool implementation.
- Providers: `duckduckgo-search` (default), `SearXNG` (configurable URL).

### Phase 3: UI Implementation
#### [NEW] `src/App.tsx`
- Chat interface (TUI style: monospaced fonts, dark theme, minimal borders).
- Markdown rendering for bot responses.
- "Copy" button for each message.

#### [NEW] `src/Settings.tsx`
- Configuration screen:
    - Provider: [Local | Remote]
    - Base URL / API Key
    - Search Provider: [DDG | SearXNG]
    - Global Hotkey Configuration
    - System Prompt

## Verification Plan

### Automated Tests
1.  **Python Unit Tests**:
    - `pytest python/tests`
    - Verify Engine abstraction (mocking LLMs).
    - Verify FastAPI endpoints.
2.  **Frontend Tests**:
    - `npm run test` (Vitest) - Component rendering.

### Manual Verification
1.  **Build Verification**:
    - Run `npm run tauri dev`.
    - Verification: App opens, Python server starts (check console logs), Health check passes.
2.  **Chat flow**:
    - Send "Hello".
    - Verify response flows appropriately from the Python sidecar.
3.  **Search flow**:
    - Send "What is the stock price of Apple right now?".
    - Verify the bot triggers a search tool and returns recent data.
4. **Window Management**:
    - Press Global Hotkey -> Window toggles.
    - Click Menubar Icon -> Window toggles.
    - Quit App -> Verify Python process terminates.
