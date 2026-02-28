import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import ChatWindow from "./components/ChatWindow";
import SettingsPanel from "./components/SettingsPanel";
import TitleBar, { type ModelConfig } from "./components/TitleBar";
import SessionTabs from "./components/SessionTabs";
import { useSidecar } from "./hooks/useSidecar";
import { useChatSessions } from "./hooks/useChatSessions";
import { ClipProvider } from "./contexts/ClipContext";

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">(() => {
    // Load from localStorage on initial render
    const saved = localStorage.getItem("lightbot-font-size");
    if (saved === "small" || saved === "medium" || saved === "large") {
      return saved;
    }
    return "medium";
  });
  const [hotkey, setHotkey] = useState("Command+Shift+O");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
    return "dark";
  });
  const [models, setModels] = useState<ModelConfig[]>([]);

  // Apply theme class to root
  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? "light" : "dark");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const { isReady, error, port: sidecarPort } = useSidecar();

  // Multi-session state management
  const { sessions, activeSessionId, createSession, deleteSession, switchSession } = useChatSessions();

  // Fetch settings from backend
  useEffect(() => {
    const fetchSettings = async () => {
      if (sidecarPort) {
        try {
          const response = await fetch(`http://127.0.0.1:${sidecarPort}/settings`);
          if (response.ok) {
            const data = await response.json();
            if (data.hotkey) {
              setHotkey(data.hotkey);
              // Sync hotkey with Rust on startup/fetch
              try {
                await invoke("update_hotkey", { newHotkey: data.hotkey });
              } catch (e) {
                console.error("Failed to sync hotkey with Rust:", e);
              }
            }
            if (data.models) setModels(data.models);
            if (typeof data.model_index === "number") setSelectedModelIndex(data.model_index);
          }
        } catch (err) {
          console.error("Failed to fetch settings:", err);
        }
      }
    };
    fetchSettings();
  }, [sidecarPort]);

  // Handle model selection change
  const handleModelChange = async (index: number) => {
    if (!sidecarPort || index === selectedModelIndex) return;

    try {
      const response = await fetch(`http://127.0.0.1:${sidecarPort}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_index: index }),
      });

      if (response.ok) {
        setSelectedModelIndex(index);
      } else {
        console.error("Failed to update model selection");
      }
    } catch (err) {
      console.error("Error updating model:", err);
    }
  };

  // Save font size to localStorage
  useEffect(() => {
    localStorage.setItem("lightbot-font-size", fontSize);
  }, [fontSize]);

  // Keyboard shortcuts for font size (only affect chat, not UI)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      if (!(e.metaKey || e.ctrlKey)) return;

      const sizes: ("small" | "medium" | "large")[] = ["small", "medium", "large"];

      switch (e.key) {
        case "+":
        case "=":
          e.preventDefault();
          setFontSize((current) => {
            const currentIndex = sizes.indexOf(current);
            return currentIndex < sizes.length - 1 ? sizes[currentIndex + 1] : current;
          });
          break;
        case "-":
        case "_":
          e.preventDefault();
          setFontSize((current) => {
            const currentIndex = sizes.indexOf(current);
            return currentIndex > 0 ? sizes[currentIndex - 1] : current;
          });
          break;
        case "0":
          e.preventDefault();
          setFontSize("medium");
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Sync pin state with actual window state
  useEffect(() => {
    const syncPinState = async () => {
      try {
        const window = getCurrentWindow();
        const pinned = await window.isAlwaysOnTop();
        setIsPinned(pinned);
      } catch (err) {
        console.error("Failed to sync pin state:", err);
      }
    };
    syncPinState();
  }, []);

  const handlePin = async () => {
    try {
      const window = getCurrentWindow();
      const nextPinned = !isPinned;
      await window.setAlwaysOnTop(nextPinned);
      setIsPinned(nextPinned);
    } catch (err) {
      console.error("Failed to set always on top:", err);
    }
  };

  const isLoading = !isReady && !error;

  return (
    <div className="h-full flex flex-col bg-surface text-text overflow-hidden">
      {/* Title Bar */}
      <TitleBar
        onSettings={() => setShowSettings(!showSettings)}
        showSettings={showSettings}
        isPinned={isPinned}
        onPin={handlePin}
        models={models}
        selectedModelIndex={selectedModelIndex}
        onModelChange={handleModelChange}
        apiPort={sidecarPort}
      />

      {/* Session Tabs */}
      <SessionTabs
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSwitchSession={switchSession}
        onCreateSession={createSession}
        onDeleteSession={deleteSession}
      />

      {/* Main Content */}
      <div className="flex-1 relative">
        {/* Chat Window - fills container */}
        <div className="absolute inset-0">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-text-muted mb-2">
                  <span className="w-1.5 h-1.5 bg-text-muted animate-pulse" />
                  <span className="w-1.5 h-1.5 bg-text-muted animate-pulse delay-75" />
                  <span className="w-1.5 h-1.5 bg-text-muted animate-pulse delay-150" />
                </div>
                <p className="text-text-muted text-sm">
                  {error ? `Error: ${error}` : "Initializing LightBot..."}
                </p>
                {sidecarPort && (
                  <p className="text-text-disabled text-xs mt-1">
                    Connected on port {sidecarPort}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <ClipProvider>
              <ChatWindow
                apiPort={sidecarPort}
                hotkey={hotkey}
                fontSize={fontSize}
                sessionId={activeSessionId}
              />
            </ClipProvider>
          )}
        </div>

        {/* Settings Panel - overlays on top */}
        {showSettings && (
          <div className="absolute right-0 top-0 h-full w-72 border-l border-border-subtle bg-surface-secondary animate-in slide-in-from-right duration-150 z-10 rounded-tl-md rounded-bl-md">
            <SettingsPanel
              onClose={() => setShowSettings(false)}
              fontSize={fontSize}
              onFontSizeChange={setFontSize}
              apiPort={sidecarPort}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
