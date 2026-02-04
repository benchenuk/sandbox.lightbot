import { useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import ChatWindow from "./components/ChatWindow";
import SettingsPanel from "./components/SettingsPanel";
import TitleBar from "./components/TitleBar";
import { useSidecar } from "./hooks/useSidecar";

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const { isReady, error, port: sidecarPort } = useSidecar();

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
    <div className="h-screen flex flex-col bg-terminal-bg text-terminal-fg overflow-hidden">
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
                <div className="text-terminal-accent text-lg mb-2">
                  <span className="inline-block animate-pulse">●</span>
                  <span className="inline-block animate-pulse delay-75">●</span>
                  <span className="inline-block animate-pulse delay-150">●</span>
                </div>
                <p className="text-terminal-dim text-sm">
                  {error ? `Error: ${error}` : "Initializing LightBot..."}
                </p>
                {sidecarPort && (
                  <p className="text-terminal-dim text-xs mt-2">
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
          <div className="w-80 border-l border-terminal-border glass animate-in slide-in-from-right duration-200">
            <SettingsPanel onClose={() => setShowSettings(false)} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
