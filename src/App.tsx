import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import ChatWindow from "./components/ChatWindow";
import SettingsPanel from "./components/SettingsPanel";
import TitleBar from "./components/TitleBar";
import { useSidecar } from "./hooks/useSidecar";

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");
  const { isReady, error, port: sidecarPort } = useSidecar();

  // Apply font size class to document
  useEffect(() => {
    document.documentElement.className = `font-size-${fontSize}`;
  }, [fontSize]);

  const isLoading = !isReady && !error;

  const handleClose = async () => {
    const window = getCurrentWindow();
    await window.hide();
  };

  const handleMinimize = async () => {
    const window = getCurrentWindow();
    await window.minimize();
  };

  return (
    <div className="h-screen flex flex-col bg-surface text-text overflow-hidden rounded-xl">
      {/* Title Bar */}
      <TitleBar
        onClose={handleClose}
        onMinimize={handleMinimize}
        onSettings={() => setShowSettings(!showSettings)}
        showSettings={showSettings}
      />

      {/* Main Content */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Chat Window */}
        <div className="flex-1 flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
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
            <ChatWindow apiPort={sidecarPort} />
          )}
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="w-72 border-l border-border-subtle bg-surface-secondary animate-in slide-in-from-right duration-150">
            <SettingsPanel 
              onClose={() => setShowSettings(false)} 
              fontSize={fontSize}
              onFontSizeChange={setFontSize}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
