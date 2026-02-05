import { useState, useEffect } from "react";
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

  return (
    <div className="h-full flex flex-col bg-surface text-text overflow-hidden">
      {/* Title Bar */}
      <TitleBar
        onSettings={() => setShowSettings(!showSettings)}
        showSettings={showSettings}
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
            <ChatWindow apiPort={sidecarPort} />
          )}
        </div>

        {/* Settings Panel - overlays on top */}
        {showSettings && (
          <div className="absolute right-0 top-0 h-full w-72 border-l border-border-subtle bg-surface-secondary animate-in slide-in-from-right duration-150 z-10">
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
