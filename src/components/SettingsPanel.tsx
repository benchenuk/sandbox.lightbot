import { useState, useEffect } from "react";

interface SettingsPanelProps {
  onClose: () => void;
  fontSize: "small" | "medium" | "large";
  onFontSizeChange: (size: "small" | "medium" | "large") => void;
}

interface Settings {
  apiBase: string;
  model: string;
  apiKey: string;
  searchProvider: "duckduckgo" | "searxng";
  searchUrl: string;
  hotkey: string;
  systemPrompt: string;
}

const defaultSettings: Settings = {
  apiBase: "http://localhost:11434",
  model: "llama3.2",
  apiKey: "",
  searchProvider: "duckduckgo",
  searchUrl: "",
  hotkey: "Command+Shift+O",
  systemPrompt:
    "You are LightBot, a helpful AI assistant with web search capabilities.",
};

export default function SettingsPanel({ onClose, fontSize, onFontSizeChange }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [activeTab, setActiveTab] = useState<"general" | "llm" | "search">("general");

  useEffect(() => {
    const saved = localStorage.getItem("lightbot-settings");
    if (saved) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      } catch {
        // Ignore parse error
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("lightbot-settings", JSON.stringify(settings));
    onClose();
  };

  const updateSetting = <K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="h-full flex flex-col bg-surface-secondary text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
        <h2 className="text-text-primary font-medium">Settings</h2>
        <button
          onClick={onClose}
          className="p-1 text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-subtle">
        {(["general", "llm", "search"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs uppercase tracking-wide transition-colors border-b-2 ${activeTab === tab
                ? "text-text-primary border-accent bg-surface-tertiary"
                : "text-text-muted border-transparent hover:text-text-primary hover:bg-surface-hover"
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === "general" && (
          <>
            <div>
              <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">
                Font Size
              </label>
              <div className="flex gap-1">
                {(["small", "medium", "large"] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => onFontSizeChange(size)}
                    className={`flex-1 py-1.5 text-xs capitalize border transition-colors ${fontSize === size
                        ? "border-accent bg-accent-subtle text-text-primary"
                        : "border-border-primary text-text-muted hover:text-text-primary hover:bg-surface-hover"
                      }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">
                Global Hotkey
              </label>
              <input
                type="text"
                value={settings.hotkey}
                onChange={(e) => updateSetting("hotkey", e.target.value)}
                className="w-full px-2 py-1.5 bg-surface border border-border-primary
                         text-text-primary text-sm focus:outline-none focus:border-accent"
                placeholder="e.g., Command+Shift+O"
              />
              <p className="text-text-disabled text-xs mt-1">
                Restart required to apply
              </p>
            </div>

            <div>
              <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">
                System Prompt
              </label>
              <textarea
                value={settings.systemPrompt}
                onChange={(e) => updateSetting("systemPrompt", e.target.value)}
                rows={5}
                className="w-full px-2 py-1.5 bg-surface border border-border-primary
                         text-text-primary text-sm focus:outline-none focus:border-accent resize-none font-sans"
              />
            </div>
          </>
        )}

        {activeTab === "llm" && (
          <>
            <div>
              <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">
                API Base
              </label>
              <input
                type="text"
                value={settings.apiBase}
                onChange={(e) => updateSetting("apiBase", e.target.value)}
                className="w-full px-2 py-1.5 bg-surface border border-border-primary
                         text-text-primary text-sm focus:outline-none focus:border-accent"
                placeholder="http://localhost:11434"
              />
              <p className="text-text-disabled text-xs mt-1">
                Ollama, OpenAI, or compatible API endpoint
              </p>
            </div>

            <div>
              <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">
                API Key (Optional)
              </label>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => updateSetting("apiKey", e.target.value)}
                className="w-full px-2 py-1.5 bg-surface border border-border-primary
                         text-text-primary text-sm focus:outline-none focus:border-accent"
                placeholder="sk-... (leave blank for local models)"
              />
            </div>

            <div>
              <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">
                Model
              </label>
              <input
                type="text"
                value={settings.model}
                onChange={(e) => updateSetting("model", e.target.value)}
                className="w-full px-2 py-1.5 bg-surface border border-border-primary
                         text-text-primary text-sm focus:outline-none focus:border-accent"
                placeholder="llama3.2, gpt-4, etc."
              />
            </div>

          </>
        )}

        {activeTab === "search" && (
          <>
            <div>
              <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">
                Search Provider
              </label>
              <select
                value={settings.searchProvider}
                onChange={(e) =>
                  updateSetting(
                    "searchProvider",
                    e.target.value as Settings["searchProvider"]
                  )
                }
                className="w-full px-2 py-1.5 bg-surface border border-border-primary
                         text-text-primary text-sm focus:outline-none focus:border-accent"
              >
                <option value="duckduckgo">DuckDuckGo</option>
                <option value="searxng">SearXNG</option>
              </select>
            </div>

            {settings.searchProvider === "searxng" && (
              <div>
                <label className="block text-text-muted text-xs uppercase tracking-wide mb-1.5">
                  SearXNG Instance URL
                </label>
                <input
                  type="text"
                  value={settings.searchUrl}
                  onChange={(e) => updateSetting("searchUrl", e.target.value)}
                  className="w-full px-2 py-1.5 bg-surface border border-border-primary
                           text-text-primary text-sm focus:outline-none focus:border-accent"
                  placeholder="http://localhost:8080"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border-subtle">
        <button
          onClick={handleSave}
          className="w-full py-1.5 bg-accent text-white text-sm
                   hover:bg-accent-hover transition-colors font-medium"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}
