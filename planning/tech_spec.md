# LightBot Technical Specification

## Project Overview

**LightBot** is a native macOS desktop AI chat application with web search capabilities. Built with a hybrid Tauri + Python architecture, it provides a lightweight, ephemeral chat experience with support for any OpenAI-compatible LLM (local or remote).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         LightBot App                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐          ┌─────────────────────────────────┐  │
│  │   Frontend   │          │           Rust Core              │  │
│  │   (React)    │◄────────►│  - System Tray Integration       │  │
│  │              │   IPC    │  - Global Hotkey (Cmd+Shift+O)   │  │
│  │  - Chat UI   │          │  - Window Management             │  │
│  │  - Settings  │          │  - Sidecar Process Spawning      │  │
│  │  - Markdown  │          │  - Sidecar Port Management       │  │
│  └──────────────┘          └─────────────────────────────────┘  │
│           ▲                          │                           │
│           │                          │ HTTP (localhost)          │
│           │         HTTP             ▼                           │
│           └──────────────────┌─────────────────────┐            │
│                              │   Python Sidecar    │            │
│                              │  (FastAPI Server)   │            │
│                              │                     │            │
│                              │  - /health          │            │
│                              │  - /chat (stream)   │            │
│                              │  - /chat/clear      │            │
│                              │  - /settings        │            │
│                              │                     │            │
│                              │  - ChatEngine       │            │
│                              │  - SearchTool       │            │
│                              └─────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Behind the Scenes: The Sidecar Bridge

LightBot uses a "Sidecar" architecture where a compiled Python binary runs as a background process alongside the main Rust application.

### 1. Sidecar Lifecycle (Rust)
- **Spawning**: On application start, Rust uses `spawn_python_sidecar` to find and execute the binary.
- **Port Selection**: Rust uses `portpicker` to find an available port dynamically, ensuring no conflicts with other apps.
- **Path Resolution**: Rust searches for the sidecar in multiple locations:
    - Bundled resource path (for production)
    - `src-tauri/bin/` (for development)
- **Health Check**: Rust polls `http://127.0.0.1:{port}/health` until the FastAPI server responds.
- **State Management**: Once healthy, the port is stored in a global `SidecarState` thread-safe mutex.

### 2. Communication Flow
- **Events**: Rust emits a `sidecar-ready` event with the port Number.
- **Commands**: The frontend can call the `get_sidecar_status` command at any time to retrieve the current port or any startup errors.
- **HTTP Bridge**: The React frontend communicates directly with the Python sidecar via standard `fetch` calls. This avoids the overhead of serializing large LLM streams through Rust's IPC.

### 3. Python Packaging (PyInstaller)
- The Python code is bundled using `PyInstaller` into a single-file executable.
- **Module Resolution**: The script uses `sys.path.append` to ensure internal modules like `engine` and `tools` are findable within the frozen environment.
- **Platform Specifics**: The build script detects `aarch64` (Apple Silicon) vs `x86_64` to name the binary correctly for Tauri's resource resolution.

---

## Technology Stack

### Frontend
| Component | Technology | Version | Status |
|-----------|-----------|---------|--------|
| Framework | React | 18.3.1 | ✅ Working |
| Build Tool | Vite | 6.4.1 | ✅ Working |
| Styling | TailwindCSS | 3.4.17 | ✅ Working |
| Language | TypeScript | 5.6.2 | ✅ Working |
| Icons | Lucide React | 0.460.0 | ✅ Working |
| Markdown | react-markdown | 9.x | ✅ Working |
| Tauri API | @tauri-apps/api | 2.x | ✅ Working |

### Desktop Framework (Rust)
| Component | Technology | Version | Status |
|-----------|-----------|---------|--------|
| Framework | Tauri | 2.10.2 | ✅ Working |
| Async Runtime | Tokio | 1.x | ✅ Working |
| HTTP Client | reqwest | 0.12 | ✅ Working |
| Port Selection | portpicker | 0.1.1 | ✅ Working |
| Global Shortcuts | tauri-plugin-global-shortcut | 2.3.1 | ✅ Working |
| Notifications | tauri-plugin-notification | 2.3.3 | ✅ Working |
| Shell | tauri-plugin-shell | 2.3.5 | ✅ Working |

### Backend (Python)
| Component | Technology | Version | Status |
|-----------|-----------|---------|--------|
| Framework | FastAPI | 0.115+ | ✅ Ready |
| Server | Uvicorn | 0.32+ | ✅ Ready |
| AI Framework | LlamaIndex | 0.12+ | ✅ Ready |
| LLM Support | OpenAI-compatible API | - | ✅ Ready |
| Search | ddgs | 6.3+ | ✅ Ready |
| Bundling | PyInstaller | 6.11+ | ✅ Ready |

---

## Development Workflow

### 1. Prerequisites
```bash
# Node.js 18+
npm install

# Python 3.12+ (Virtual Environment Recommended)
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -e ".[dev]"

# Rust (via rustup)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. Building the Sidecar (Required for first run)
The application expects a binary in `src-tauri/bin/`.
```bash
source venv/bin/activate
./scripts/build-sidecar.sh
```

### 3. Running Development
```bash
# Recommended: Let Tauri handle everything
npm run tauri-dev

# Alternative: Manually running backend (useful for debugging)
source venv/bin/activate
uvicorn python.server:app --port 8080 --reload
```

---

## Troubleshooting

### "Port 5173 is already in use"
Vite (the frontend dev server) uses port 5173. If an old process is stuck:
```bash
# Find the process ID
lsof -i :5173
# Kill it (replace PID with the number from above)
kill -9 PID
```

### "Sidecar health check failed"
- Ensure your Python virtual environment is active.
- Check if another process is holding the port selected by Rust (look at logs).
- Try running the sidecar manually to see Python errors: `./src-tauri/bin/python-sidecar --port 8081`

### "ModuleNotFoundError: No module named 'engine'"
This usually happens if `PyInstaller` didn't include the local modules. Ensure you use the updated `./scripts/build-sidecar.sh` which includes `--paths python`.

### Tray Icon Shows White Square
**Problem**: The system tray icon appears as a blank white square instead of the app icon.

**Root Cause**: `icon_as_template(true)` tells macOS to treat the icon as a monochrome template image, which tints it white. This only works correctly with black silhouette icons designed as templates.

**Solution**: 
```rust
// ❌ Wrong - causes white square with colored icons
TrayIconBuilder::new()
    .icon(icon)
    .icon_as_template(true)  // Only use with black silhouette icons

// ✅ Correct - shows actual colored icon
TrayIconBuilder::new()
    .icon(icon)
    // icon_as_template omitted or set to false
```

**Trade-offs**:
| Setting | Appearance | Dark Mode Support |
|---------|-----------|-------------------|
| `icon_as_template(true)` | Requires black silhouette icon | ✅ Native adaptation |
| `icon_as_template(false)` | Shows actual icon colors | ❌ No auto-adaptation |


---

## API Endpoints

### Python Sidecar (FastAPI)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (returns 200 OK) |
| POST | `/chat/stream` | Streaming chat with conversation history |
| POST | `/chat/clear` | Clears memory for a specific session |
| GET | `/settings` | Returns current LLM/search configuration |
| POST | `/settings` | Updates configuration on the fly |

### API Payload (`/chat` & `/chat/stream`)
```json
{
  "message": "User query",
  "session_id": "optional-session-id",
  "search_mode": "off" | "on" | "auto"  // Default: "off"
}
```

### Settings API Response (`GET /settings`)
```json
{
  "models": [
    {"name": "gpt-4", "url": "https://api.openai.com/v1", "key": "sk-..."},
    {"name": "llama3.1", "url": "http://localhost:11434", "key": ""}
  ],
  "model_index": 0,
  "fast_models": [
    {"name": "gpt-3.5-turbo", "url": "https://api.openai.com/v1", "key": "sk-..."}
  ],
  "fast_model_index": 0,
  "system_prompt": "You are a helpful AI assistant...",
  "search_provider": "ddgs",
  "search_url": "",
  "hotkey": "Command+Shift+O"
}
```

## Configuration (Environment Variables)

The Sidecar is configured via `.env` file with JSON-based model configurations:

### Model Configuration Format
Models are stored as JSON arrays, allowing multiple model configurations per provider:

```bash
# Primary models for chat (JSON array)
LLM_MODELS=[{"name":"gpt-4","url":"https://api.openai.com/v1","key":"sk-..."},{"name":"llama3.1","url":"http://localhost:11434","key":""}]
LLM_MODEL_INDEX=0  # Index of active model

# Fast models for query rewriting (JSON array)
LLM_FAST_MODELS=[{"name":"gpt-3.5-turbo","url":"https://api.openai.com/v1","key":"sk-..."}]
LLM_FAST_MODEL_INDEX=0

# Other settings
LLM_SYSTEM_PROMPT=You are a helpful AI assistant...
SEARCH_PROVIDER=ddgs
SEARCH_URL=
GLOBAL_HOTKEY=Command+Shift+O
```

Each model config object contains:
- `name`: Model identifier (e.g., "gpt-4", "llama3.1")
- `url`: OpenAI-compatible API base URL
- `key`: API key (can be empty for local models)


### IPC Commands (Rust)

| Command | Return Type | Description |
|-----------|-------|-------------|
| `get_sidecar_status` | `u16` (port) | Returns the port of the running sidecar |

---

## LlamaIndex Framework

LightBot uses **LlamaIndex** as the core AI framework for orchestrating chat interactions. While we use LlamaIndex's abstractions, the actual LLM communication is done through OpenAI-compatible APIs.

### Core Components

**1. ChatEngine (`python/engine.py`)**
The central orchestrator that manages:
- Ephemeral conversation memory (session-based)
- LLM initialization and configuration
- Streaming response handling
- Search integration for web-enhanced responses

**2. OpenAILike LLM Integration**
Uses LlamaIndex's `OpenAILike` class for maximum compatibility:
```python
from llama_index.llms.openai_like import OpenAILike

self.llm = OpenAILike(
    model=self.model,           # e.g., "gpt-4", "llama3.1"
    api_key=api_key,
    api_base=self.base_url,     # e.g., "https://api.openai.com/v1"
    is_chat_model=True,
    timeout=60.0,
)
```

**3. ChatMessage & Memory Management**
LlamaIndex's `ChatMessage` and `MessageRole` abstractions provide:
- Structured message format (USER/ASSISTANT/SYSTEM roles)
- Conversation history tracking per session
- Easy integration with LLM completions

```python
from llama_index.core.llms import ChatMessage, MessageRole

# Storing messages
self._memory[sid].append(
    ChatMessage(role=MessageRole.USER, content=message)
)

# Streaming responses
response = await self.llm.astream_chat(messages)
async for token in response:
    yield token.delta
```

**4. Search Integration**
When web search is enabled, the flow is:
1. User message received
2. **Query Rewriting**: Fast LLM rewrites query using conversation history (via `QueryRewriter`)
3. **Web Search**: `SearchTool` performs search with rewritten query
4. **Context Injection**: Search results injected into system prompt
5. **Response Generation**: Primary LLM generates answer with search context

### Why LlamaIndex?

| Feature | Benefit |
|---------|---------|
| **OpenAI-Compatible** | Works with any OpenAI-compatible API (OpenAI, Ollama, vLLM, etc.) |
| **Streaming Support** | Native async streaming for real-time responses |
| **Chat Abstractions** | Clean message/history management |
| **Modular Design** | Easy to swap LLM providers or add new capabilities |
| **Lightweight** | Only using core LLM features, not heavy indexing/RAG |

---

## Implementation Status

### Phase 1-4: Core Development ✅ COMPLETE
- [x] TUI-inspired React Frontend
- [x] Rust Core (Tray, Hotkeys, Window Management)
- [x] Python LlamaIndex Engine (OpenAI-compatible)
- [x] Sidecar Integration bridge
- [x] JSON-based Multi-Model Configuration
- [x] Collapsible Model Editor UI

### Phase 5: Packaging & Distribution 🔄 IN PROGRESS
- [x] PyInstaller Build Script
- [x] Multi-path discovery in Rust
- [x] Manual Dev Mode support
- [x] macOS App Bundling
- [x] Version bumping automation
- [ ] Code Signing & Notarization

---

## Release Process

### Build ID Format
**Format**: `{version}+YYYYMMDD.{git_short_hash}`  
**Example**: `0.2.0+20250206.a1b2c3d`

This format provides:
- **Version**: Semantic version for compatibility
- **Date**: When the build was created
- **Git Hash**: Exact code revision for traceability

### Version Bumping

For development environment setup or preparing for a release:

```bash
# Bump version across all config files
./scripts/bump-version.sh [version]

# Example: Set version to 0.2.0
./scripts/bump-version.sh 0.2.0
```

**Files updated:**
- `package.json`
- `package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `pyproject.toml`
- `python/server.py` (HealthResponse & FastAPI versions)

### Release Script

```bash
# Create a new release
./scripts/release.sh [version]

# Example: Release version 0.2.0
./scripts/release.sh 0.2.0
```

**What the script does:**
1. Calls `bump-version.sh` to update all version numbers
2. Warns if uncommitted changes exist
3. Builds Python sidecar (PyInstaller)
4. Sets `VITE_BUILD_ID` env var
5. Builds Tauri application
6. Updates `Cargo.lock`
7. Outputs signed/unsigned DMG

### Files Updated During Release

| File | Content Updated | Notes |
|------|----------------|-------|
| `package.json` | `"version": "X.Y.Z"` | NPM package version |
| `package-lock.json` | Version synced | Auto-updated via `npm install` |
| `src-tauri/tauri.conf.json` | `"version": "X.Y.Z"` | Tauri app version |
| `src-tauri/Cargo.toml` | `version = "X.Y.Z"` | Rust package version |
| `src-tauri/Cargo.lock` | Version synced | Auto-updated via `cargo update` |
| `pyproject.toml` | `version = "X.Y.Z"` | Python package version |
| `python/server.py` | `version="X.Y.Z"` | HealthResponse & FastAPI version |

### Build Output

```
src-tauri/target/release/bundle/
├── macos/
│   └── LightBot.app              # Unsigned app bundle
└── dmg/
    └── LightBot_0.2.0.dmg        # Unsigned DMG installer
```

### Code Signing & Notarization (Placeholder)

For local development/testing, unsigned builds work fine. For distribution:

```bash
# 1. Code sign the app bundle
codesign --force --options runtime \
  --sign "Developer ID Application: Your Name" \
  "src-tauri/target/release/bundle/macos/LightBot.app"

# 2. Create signed DMG (using create-dmg or similar)

# 3. Notarize the DMG
xcrun notarytool submit "LightBot_0.2.0.dmg" \
  --keychain-profile "AC_PASSWORD" \
  --wait

# 4. Staple notarization ticket
xcrun stapler staple "LightBot_0.2.0.dmg"
```

### Displaying Build Info

The build ID is displayed in Settings → General tab:

```typescript
// vite.config.ts - Build ID is injected at build time
define: {
  __APP_BUILD_ID__: JSON.stringify(process.env.VITE_BUILD_ID || "dev"),
}
```

```typescript
// SettingsPanel.tsx - Display in UI
<span>BUILD: {__APP_BUILD_ID__}</span>
// Example output: BUILD: 0.2.0+20250206.a1b2c3d
```

### Logging (Simplified)

**Status**: File logging solution was attempted and abandoned due to complexity and process handling issues.

**Current Approach**:
- **Development**: Output goes to terminal/stdout
- **Production**: Output captured by macOS Console.app automatically

**Rationale**:
1. **File redirection broke sidecar spawning** - Attempting to redirect sidecar stdout/stderr to a log file handle caused process spawning issues (`try_clone()` failures, handle ownership problems)
2. **Added complexity** - External crates (`flexi_logger`, `chrono`) and rotation logic were overkill
3. **Console.app is sufficient** - macOS already captures app output for debugging

**Viewing Logs**:
```bash
# Development - terminal output
npm run tauri-dev

# Production - view in Console.app
# Applications → Utilities → Console
# Filter by "LightBot" process
```

**Historical Note**: Earlier versions attempted file-based logging with rotation (5MB x 3 files) but this was abandoned in v1.1.6. The issue was root-caused to `child.try_wait()` interfering with process spawning, not the logging itself, but the simplification was kept.

---

*Last Updated: 2026-02-09*
