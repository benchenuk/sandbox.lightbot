import { X } from "lucide-react";
import { useState, useEffect } from "react";

interface SettingsPanelProps {
  onClose: () => void;
}

interface Settings {
  provider: "ollama" | "openai";
  model: string;
  baseUrl: string;
  apiKey: string;
  searchProvider: "duckduckgo" | "searxng";
  searchUrl: string;
  hotkey: string;
  systemPrompt: string;
}

const defaultSettings: Settings = {
  provider: "ollama",
  model: "llama3.2",
  baseUrl: "http://localhost:11434",
  apiKey: "",
  searchProvider: "duckduckgo",
  searchUrl: "",
  hotkey: "Command+Shift+O",
  systemPrompt:
    "You are LightBot, a helpful AI assistant with web search capabilities.",
};

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [activeTab, setActiveTab] = useState<"general" | "llm" | "search">("general");

  useEffect(() => {
    // Load settings from localStorage
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
    <div className="h-full flex flex-col bg-terminal-bg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-terminal-border">
        <h2 className="text-terminal-fg font-medium">Settings</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded text-terminal-dim hover:text-terminal-fg hover:bg-terminal-border transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-terminal-border">
        {(["general", "llm", "search"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-sm capitalize transition-colors ${
              activeTab === tab
                ? "text-terminal-accent border-b-2 border-terminal-accent"
                : "text-terminal-dim hover:text-terminal-fg"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === "general" && (
          <>
            <div>
              <label className="block text-terminal-dim text-xs mb-1.5">
                Global Hotkey
              </label>
              <input
                type="text"
                value={settings.hotkey}
                onChange={(e) => updateSetting("hotkey", e.target.value)}
                className="w-full px-3 py-2 bg-terminal-bg border border-terminal-border rounded 
                         text-terminal-fg text-sm focus:outline-none focus:border-terminal-accent"
                placeholder="e.g., Command+Shift+O"
              />
              <p className="text-terminal-dim text-xs mt-1">
                Restart required to apply hotkey changes
              </p>
            </div>

            <div>
              <label className="block text-terminal-dim text-xs mb-1.5">
                System Prompt
              </label>
              <textarea
                value={settings.systemPrompt}
                onChange={(e) => updateSetting("systemPrompt", e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-terminal-bg border border-terminal-border rounded 
                         text-terminal-fg text-sm focus:outline-none focus:border-terminal-accent resize-none"
              />
            </div>
          </>
        )}

        {activeTab === "llm" && (
          <>
            <div>
              <label className="block text-terminal-dim text-xs mb-1.5">
                Provider
              </label>
              <select
                value={settings.provider}
                onChange={(e) =>
                  updateSetting("provider", e.target.value as Settings["provider"])
                }
                className="w-full px-3 py-2 bg-terminal-bg border border-terminal-border rounded 
                         text-terminal-fg text-sm focus:outline-none focus:border-terminal-accent"
              >
                <option value="ollama">Ollama (Local)</option>
                <option value="openai">OpenAI (Remote)</option>
              </select>
            </div>

            <div>
              <label className="block text-terminal-dim text-xs mb-1.5">
                Model
              </label>
              <input
                type="text"
                value={settings.model}
                onChange={(e) => updateSetting("model", e.target.value)}
                className="w-full px-3 py-2 bg-terminal-bg border border-terminal-border rounded 
                         text-terminal-fg text-sm focus:outline-none focus:border-terminal-accent"
                placeholder={
                  settings.provider === "ollama" ? "llama3.2" : "gpt-4"
                }
              />
            </div>

            <div>
              <label className="block text-terminal-dim text-xs mb-1.5">
                Base URL (Optional)
              </label>
              <input
                type="text"
                value={settings.baseUrl}
                onChange={(e) => updateSetting("baseUrl", e.target.value)}
                className="w-full px-3 py-2 bg-terminal-bg border border-terminal-border rounded 
                         text-terminal-fg text-sm focus:outline-none focus:border-terminal-accent"
                placeholder={
                  settings.provider === "ollama"
                    ? "http://localhost:11434"
                    : "https://api.openai.com/v1"
                }
              />
            </div>

            {settings.provider === "openai" && (
              <div>
                <label className="block text-terminal-dim text-xs mb-1.5">
                  API Key
                </label>
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => updateSetting("apiKey", e.target.value)}
                  className="w-full px-3 py-2 bg-terminal-bg border border-terminal-border rounded 
                           text-terminal-fg text-sm focus:outline-none focus:border-terminal-accent"
                  placeholder="sk-..."
                />
              </div>
            )}
          </>
        )}

        {activeTab === "search" && (
          <>
            <div>
              <label className="block text-terminal-dim text-xs mb-1.5">
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
                className="w-full px-3 py-2 bg-terminal-bg border border-terminal-border rounded 
                         text-terminal-fg text-sm focus:outline-none focus:border-terminal-accent"
              >
                <option value="duckduckgo">DuckDuckGo</option>
                <option value="searxng">SearXNG</option>
              </select>
            </div>

            {settings.searchProvider === "searxng" && (
              <div>
                <label className="block text-terminal-dim text-xs mb-1.5">
                  SearXNG Instance URL
                </label>
                <input
                  type="text"
                  value={settings.searchUrl}
                  onChange={(e) => updateSetting("searchUrl", e.target.value)}
                  className="w-full px-3 py-2 bg-terminal-bg border border-terminal-border rounded 
                           text-terminal-fg text-sm focus:outline-none focus:border-terminal-accent"
                  placeholder="http://localhost:8080"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-terminal-border">
        <button
          onClick={handleSave}
          className="w-full py-2 bg-terminal-accent text-terminal-bg rounded-lg 
                   font-medium hover:bg-terminal-accent/90 transition-colors"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}
