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
| Search | duckduckgo-search | 6.3+ | ✅ Ready |
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

## Configuration (Environment Variables)

The Sidecar can be configured via `.env` to support Dual Models without UI changes:
- `LLM_MODEL`: Primary model for reasoning/answering (e.g., `gpt-4o`, `llama3.1`).
- `LLM_FAST_MODEL`: Fast model for query rewriting (e.g., `gpt-4o-mini`, `llama3.2`).
- `LLM_BASE_URL`: OpenAI-compatible API base URL.
- `LLM_API_KEY`: API key for the provider.


### IPC Commands (Rust)

| Command | Return Type | Description |
|-----------|-------|-------------|
| `get_sidecar_status` | `u16` (port) | Returns the port of the running sidecar |

---

## Implementation Status

### Phase 1-4: Core Development ✅ COMPLETE
- [x] TUI-inspired React Frontend
- [x] Rust Core (Tray, Hotkeys, Window Management)
- [x] Python LlamaIndex Engine (OpenAI-compatible)
- [x] Sidecar Integration bridge

### Phase 5: Packaging & Distribution 🔄 IN PROGRESS
- [x] PyInstaller Build Script
- [x] Multi-path discovery in Rust
- [x] Manual Dev Mode support
- [ ] macOS App Bundling
- [ ] Code Signing & Notarization

---

*Last Updated: 2026-02-05*
