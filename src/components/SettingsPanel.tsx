import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import ModelConfigEditor, { type ModelConfig } from "./ModelConfigEditor";

interface SettingsPanelProps {
  onClose: () => void;
  fontSize: "small" | "medium" | "large";
  onFontSizeChange: (size: "small" | "medium" | "large") => void;
  apiPort: number | null;
  onRefresh?: () => void;
}

interface Settings {
  models: ModelConfig[];
  modelIndex: number;
  fastModels: ModelConfig[];
  fastModelIndex: number;
  searchProvider: "ddgs" | "searxng";
  searchUrl: string;
  hotkey: string;
  systemPrompt: string;
  clippingsPath: string;
  retainThinking: boolean;
}

const emptySettings: Settings = {
  models: [],
  modelIndex: 0,
  fastModels: [],
  fastModelIndex: 0,
  searchProvider: "ddgs",
  searchUrl: "",
  hotkey: "Command+Shift+O",
  systemPrompt: "",
  clippingsPath: "~/.lightbot/clippings",
  retainThinking: true,
};

export default function SettingsPanel({ onClose, fontSize, onFontSizeChange, apiPort, onRefresh }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [initialHotkey, setInitialHotkey] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"general" | "llm" | "search">("llm");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch settings from backend on mount
  useEffect(() => {
    const fetchSettings = async () => {
      if (!apiPort) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`http://127.0.0.1:${apiPort}/settings`);
        if (!response.ok) throw new Error("Failed to fetch settings");

        const backendSettings = await response.json();

        // Use backend values (may be empty arrays)
        setSettings({
          models: backendSettings.models || [],
          modelIndex: backendSettings.model_index || 0,
          fastModels: backendSettings.fast_models || [],
          fastModelIndex: backendSettings.fast_model_index || 0,
          searchProvider: (backendSettings.search_provider as Settings["searchProvider"]) || "ddgs",
          searchUrl: backendSettings.search_url || "",
          hotkey: backendSettings.hotkey || "Command+Shift+O",
          systemPrompt: backendSettings.system_prompt || "",
          clippingsPath: backendSettings.clippings_path || "clippings",
          retainThinking: backendSettings.retain_thinking !== undefined ? backendSettings.retain_thinking : true,
        });
        setInitialHotkey(backendSettings.hotkey || "Command+Shift+O");
        setError(null);
      } catch (err) {
        setError("Failed to load settings from backend");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [apiPort]);

  const handleSave = async () => {
    if (!apiPort) {
      setError("Backend not connected");
      return;
    }

    try {
      // Map UI settings to backend format
      const backendSettings = {
        models: settings.models,
        model_index: settings.modelIndex,
        fast_models: settings.fastModels,
        fast_model_index: settings.fastModelIndex,
        system_prompt: settings.systemPrompt,
        search_provider: settings.searchProvider,
        search_url: settings.searchUrl,
        hotkey: settings.hotkey,
        clippings_path: settings.clippingsPath,
        retain_thinking: settings.retainThinking,
      };

      const response = await fetch(`http://127.0.0.1:${apiPort}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backendSettings),
      });

      if (!response.ok) throw new Error("Failed to save settings");

      // Update hotkey in Rust if it changed
      if (settings.hotkey !== initialHotkey) {
        try {
          await invoke("update_hotkey", { newHotkey: settings.hotkey });
        } catch (e) {
          console.error("Failed to update hotkey:", e);
          setError("Settings saved, but failed to update hotkey. Restart required.");
          return;
        }
      }

      setError(null);
      onRefresh?.();
      onClose();
    } catch (err) {
      setError("Failed to save settings to backend");
    }
  };

  const handleModelsChange = (models: ModelConfig[], selectedIndex: number) => {
    setSettings((prev) => ({ ...prev, models, modelIndex: selectedIndex }));
  };

  const handleFastModelsChange = (fastModels: ModelConfig[], selectedIndex: number) => {
    setSettings((prev) => ({ ...prev, fastModels, fastModelIndex: selectedIndex }));
  };

  const updateSetting = <K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-surface-secondary text-sm">
        <div className="flex-1 flex items-center justify-center">
          <span className="text-text-muted">Loading settings...</span>
        </div>
      </div>
    );
  }

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

      {/* Error Banner */}
      {error && (
        <div className="px-3 pt-2">
          <div className="px-3 py-1.5 bg-error/10 border border-error/30 text-error text-xs rounded-md">
            {error}
          </div>
        </div>
      )}

      {/* Tabs */}
      {/* Tabs */}
      <div className="flex border-b border-border-subtle bg-surface/30">
        {(["llm", "search", "general"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-[0.1em] transition-all border-b-2 ${activeTab === tab
              ? "text-accent border-accent bg-accent/5"
              : "text-text-disabled border-transparent hover:text-text-muted hover:bg-surface-hover"
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === "general" && (
          <div className="flex flex-col h-full space-y-4">
            {/* Font Size */}
            <div className="space-y-2">
              <div>
                <label className="block text-text-disabled text-[10px] font-bold uppercase tracking-wider mb-0.5">Font Size</label>
                <div className="text-xs text-text-muted">Adjust message scale for better readability</div>
              </div>
              <div className="flex gap-1">
                {(["small", "medium", "large"] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => onFontSizeChange(size)}
                    className={`flex-1 py-1.5 text-xs capitalize border transition-colors rounded-md ${fontSize === size
                      ? "border-accent bg-accent/5 text-accent"
                      : "border-border-subtle text-text-muted hover:text-text-primary hover:bg-surface-hover"
                      }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Retain Thinking */}
            <div className="pt-3 border-t border-border-subtle/30">
              <label className="block text-text-disabled text-[10px] font-bold uppercase tracking-wider mb-0.5">Retain Thinking</label>
              <div className="flex items-center justify-between">
                <div className="text-xs text-text-muted">Keep model reasoning in chat history</div>
                <label className="relative inline-flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={settings.retainThinking}
                    onChange={(e) => updateSetting("retainThinking", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-surface-tertiary rounded-full peer peer-checked:bg-accent after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-white group-hover:after:bg-text-secondary"></div>
                </label>
              </div>
            </div>

            {/* Global Hotkey */}
            <div className="pt-3 border-t border-border-subtle/30 space-y-2">
              <div>
                <label className="block text-text-disabled text-[10px] font-bold uppercase tracking-wider mb-0.5">Global Hotkey</label>
                <div className="text-xs text-text-muted">Toggle the application window (e.g. Cmd+Shift+O)</div>
              </div>
              <input
                type="text"
                value={settings.hotkey}
                onChange={(e) => updateSetting("hotkey", e.target.value)}
                className="w-full px-3 py-1.5 bg-surface border border-border-subtle rounded-lg
                         text-text-primary text-sm focus:outline-none focus:border-accent/30"
                placeholder="Command+Shift+O"
              />
            </div>

            {/* Clippings Folder */}
            <div className="pt-3 border-t border-border-subtle/30 space-y-2">
              <div>
                <label className="block text-text-disabled text-[10px] font-bold uppercase tracking-wider mb-0.5">Clippings Folder</label>
                <div className="text-xs text-text-muted truncate">Local storage relative to root</div>
              </div>
              <input
                type="text"
                value={settings.clippingsPath}
                onChange={(e) => updateSetting("clippingsPath", e.target.value)}
                className="w-full px-3 py-1.5 bg-surface border border-border-subtle rounded-lg
                         text-text-primary text-sm focus:outline-none focus:border-accent/30"
                placeholder="clippings"
              />
            </div>

            {/* Build Info */}
            <div className="mt-auto pt-4 border-t border-border-subtle/30">
              <span className="text-[10px] font-mono text-text-disabled uppercase tracking-tighter opacity-50">
                BUILD: {__APP_BUILD_ID__}
              </span>
            </div>
          </div>
        )}

        {activeTab === "llm" && (
          <div className="flex flex-col h-full min-h-0 space-y-5">
            <div className="flex-shrink-0 space-y-5">
              <ModelConfigEditor
                title="Models"
                models={settings.models}
                selectedIndex={settings.modelIndex}
                onModelsChange={handleModelsChange}
              />
              <ModelConfigEditor
                title="Fast Models"
                models={settings.fastModels}
                selectedIndex={settings.fastModelIndex}
                onModelsChange={handleFastModelsChange}
              />
            </div>

            <div className="flex-1 min-h-0 pt-4 border-t border-border-subtle/30 flex flex-col space-y-2">
              <label className="block text-text-disabled text-[10px] font-bold uppercase tracking-wider">
                System Prompt
              </label>
              <textarea
                value={settings.systemPrompt}
                onChange={(e) => updateSetting("systemPrompt", e.target.value)}
                className="flex-1 min-h-[100px] w-full px-3 py-2 bg-surface border border-border-subtle rounded-lg
                           text-text-primary text-sm focus:outline-none focus:border-accent/50 font-sans resize-none"
                placeholder="Enter system instructions..."
              />
            </div>
          </div>
        )}

        {activeTab === "search" && (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="block text-text-disabled text-[10px] font-bold uppercase tracking-wider">
                Search Provider
              </label>
              <select
                value={settings.searchProvider}
                onChange={(e) => updateSetting("searchProvider", e.target.value as Settings["searchProvider"])}
                className="w-full px-3 py-2 bg-surface border border-border-subtle rounded-lg
                           text-text-primary text-sm focus:outline-none focus:border-accent/50"
              >
                <option value="ddgs">DuckDuckGo (DDGS)</option>
                <option value="searxng">SearXNG (Self-hosted)</option>
              </select>
            </div>

            {settings.searchProvider === "searxng" && (
              <div className="pt-4 border-t border-border-subtle/30 space-y-2">
                <label className="block text-text-disabled text-[10px] font-bold uppercase tracking-wider">
                  SearXNG Instance URL
                </label>
                <input
                  type="text"
                  value={settings.searchUrl}
                  onChange={(e) => updateSetting("searchUrl", e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border-subtle rounded-lg
                             text-text-primary text-sm focus:outline-none focus:border-accent/50"
                  placeholder="https://search.example.com"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border-subtle bg-surface/30">
        <button
          onClick={handleSave}
          className="w-full py-2 bg-accent text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-lg
                     hover:bg-accent-hover active:scale-[0.98] transition-all shadow-lg shadow-accent/20"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}
