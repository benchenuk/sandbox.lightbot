# LightBot

A lightweight, native MacOS desktop AI chat application with web search capabilities.

## Features

- 🤖 **AI Chat**: Support for both local (Ollama) and remote (OpenAI) LLMs
- 🔍 **Web Search**: Integrated DuckDuckGo and SearXNG search
- 💻 **Native App**: Built with Tauri for native MacOS experience
- ⚡ **Global Hotkey**: Quick access from anywhere (default: `Cmd+Shift+O`)
- 🔔 **System Tray**: Runs in background with menubar access
- 🎨 **TUI Style**: Minimalist terminal-inspired design
- 💾 **Ephemeral Memory**: No long-term storage, session-only chat history

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     LightBot App                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐         ┌───────────────────────────────┐  │
│  │  Frontend   │         │           Rust Core           │  │
│  │  (React)    │◄───────►│  - System Tray                │  │
│  │             │  IPC    │  - Global Hotkey              │  │
│  │  - Chat UI  │         │  - Window Management          │  │
│  │  - Settings │         │  - Sidecar Spawning           │  │
│  └─────────────┘         └───────────────────────────────┘  │
│                                   │                         │
│                                   │ HTTP                    │
│                                   ▼                         │
│                         ┌─────────────────────┐            │
│                         │   Python Sidecar    │            │
│                         │  (FastAPI Server)   │            │
│                         │                     │            │
│                         │  - Chat Engine      │            │
│                         │  - Web Search       │            │
│                         │  - LLM Interface    │            │
│                         └─────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Desktop Framework**: Tauri v2 (Rust)
- **Backend**: Python + FastAPI
- **AI Framework**: LlamaIndex
- **LLM Support**: Ollama (local), OpenAI (remote)
- **Search**: DuckDuckGo, SearXNG

## Prerequisites

- Node.js 18+
- Python 3.12+
- Rust (for Tauri)
- macOS (primary target platform)

## Development Setup

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Create and activate Python virtual environment
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip

# Install Python dependencies
pip install -e ".[dev]"
```

### 2. Configure Environment (Optional)

```bash
cp .env.example .env
# Edit .env with your API keys and settings
```

### 3. Run Development Server

```bash
# This starts both the frontend dev server and Tauri
npm run tauri-dev
```

## Building

### Build Python Sidecar

```bash
./scripts/build-sidecar.sh
```

### Build Full Application

```bash
npm run tauri-build
```

The built app will be in `src-tauri/target/release/bundle/`.

## Documentation

- [Technical Specification](planning/tech_spec.md) - Detailed architecture, API docs, and implementation status
- [Implementation Plan](planning/implementation_plan.md) - Original project plan
- [Wishlist](planning/wishlist.md) - Feature ideas and future enhancements

## Project Structure

```
lightbot/
├── src/                    # Frontend React source
│   ├── components/         # React components
│   ├── hooks/              # Custom React hooks
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── src-tauri/              # Tauri/Rust source
│   ├── src/                # Rust source code
│   ├── icons/              # App icons
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── python/                 # Python sidecar
│   ├── server.py           # FastAPI server
│   ├── engine.py           # Chat engine
│   └── tools/              # Tools (search, etc.)
├── scripts/                # Build scripts
├── planning/               # Project planning docs
└── README.md
```

## Configuration

Settings are stored in localStorage and include:

- **LLM Provider**: Ollama or OpenAI
- **Model**: e.g., llama3.2, gpt-4
- **Base URL**: Custom endpoint for self-hosted models
- **API Key**: For remote providers
- **Search Provider**: DuckDuckGo or SearXNG
- **Global Hotkey**: Configurable keyboard shortcut
- **System Prompt**: Customizable AI behavior

## License

MIT
