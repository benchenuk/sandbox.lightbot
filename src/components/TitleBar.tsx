import { useState } from "react";
import { Settings, Pin, ChevronDown, Brain } from "lucide-react";

export interface ModelConfig {
  name: string;
  url: string;
  key: string;
  think?: boolean;
  alias?: string;
}

interface TitleBarProps {
  onSettings: () => void;
  showSettings: boolean;
  isPinned: boolean;
  onPin: () => void;
  models: ModelConfig[];
  selectedModelIndex: number;
  onModelChange: (index: number) => void;
  onToggleThink?: () => void;
  apiPort: number | null;
}

export default function TitleBar({
  onSettings,
  showSettings,
  isPinned,
  onPin,
  models,
  selectedModelIndex,
  onModelChange,
  onToggleThink,
  apiPort,
}: TitleBarProps) {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const handleModelSelect = (index: number) => {
    onModelChange(index);
    setIsModelDropdownOpen(false);
  };

  const currentModel = models[selectedModelIndex];
  const currentModelDisplayName = currentModel?.alias || currentModel?.name || "No Model";
  const hasModels = models.length > 0;

  return (
    <div
      data-tauri-drag-region
      className="h-9 flex items-center justify-between px-3 pl-20 border-b border-border-subtle bg-surface select-none cursor-default"
    >
      {/* Left spacer */}
      <div className="flex items-center gap-2 pointer-events-none">
        <div className="w-2 h-2" />
      </div>

      {/* Center/Right Controls */}
      <div className="flex items-center gap-0.5">
        {/* Model Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            disabled={!hasModels}
            className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors rounded-md ${!hasModels
              ? "text-text-disabled cursor-not-allowed"
              : isModelDropdownOpen
                ? "text-accent bg-accent-subtle"
                : "text-text-muted hover:text-text-primary hover:bg-surface-hover"
              }`}
            title={hasModels ? "Select Model" : "No models configured"}
          >
            <span
              className="max-w-[120px] truncate text-right"
              style={{ direction: "rtl" }}
            >
              {currentModelDisplayName}
            </span>
            {hasModels && (
              <ChevronDown
                size={12}
                className={`transition-transform ${isModelDropdownOpen ? "rotate-180" : ""
                  }`}
              />
            )}
          </button>

          {isModelDropdownOpen && hasModels && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsModelDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border-subtle rounded-md shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
                {models.map((model, index) => (
                  <button
                    key={`${model.name}-${index}`}
                    onClick={() => handleModelSelect(index)}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors truncate ${selectedModelIndex === index
                      ? "text-accent bg-accent-subtle/50"
                      : "text-text-primary hover:bg-surface-hover"
                      }`}
                    title={model.name}
                  >
                    {model.alias || model.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Reasoning (Think) Toggle - Following the selector */}
        {hasModels && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleThink?.();
            }}
            disabled={models[selectedModelIndex]?.think === undefined}
            className={`p-1.5 transition-colors rounded-md ${models[selectedModelIndex]?.think === undefined
              ? "text-text-muted opacity-40 cursor-not-allowed"
              : models[selectedModelIndex]?.think
                ? "text-white bg-accent"
                : "text-text-muted hover:text-text-primary hover:bg-surface-hover"
              }`}
            title={
              models[selectedModelIndex]?.think === undefined
                ? "Reasoning not supported for this model"
                : models[selectedModelIndex]?.think
                  ? "Reasoning Enabled (Click to Disable)"
                  : "Reasoning Disabled (Click to Enable)"
            }
          >
            <Brain size={14} />
          </button>
        )}

        <button
          onClick={onSettings}
          disabled={apiPort === null}
          className={`p-1.5 transition-colors rounded-md ${showSettings
            ? "text-white bg-accent"
            : "text-text-muted hover:text-text-primary hover:bg-surface-hover"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          title={apiPort === null ? "Loading ..." : "Settings"}
        >
          <Settings size={14} />
        </button>
        <button
          onClick={onPin}
          className={`p-1.5 transition-colors rounded-md ${isPinned
            ? "text-white bg-accent"
            : "text-text-muted hover:text-text-primary hover:bg-surface-hover"
            }`}
          title={isPinned ? "Unpin window" : "Pin window (Always on Top)"}
        >
          <Pin size={14} />
        </button>
      </div>
    </div>
  );
}
