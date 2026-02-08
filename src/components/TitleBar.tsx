import { useState } from "react";
import { Settings, Pin, ChevronDown } from "lucide-react";

interface TitleBarProps {
  onSettings: () => void;
  showSettings: boolean;
  isPinned: boolean;
  onPin: () => void;
  availableModels: string[];
  selectedModelIndex: number;
  onModelChange: (index: number) => void;
  apiPort: number | null;
}

export default function TitleBar({
  onSettings,
  showSettings,
  isPinned,
  onPin,
  availableModels,
  selectedModelIndex,
  onModelChange,
}: TitleBarProps) {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const handleModelSelect = (index: number) => {
    onModelChange(index);
    setIsModelDropdownOpen(false);
  };

  // Show placeholder if no models configured
  const currentModelName = availableModels[selectedModelIndex] || "No Model";
  const hasModels = availableModels.length > 0;

  return (
    <div
      data-tauri-drag-region
      className="h-9 flex items-center justify-between px-3 pl-20 border-b border-border-subtle bg-surface select-none cursor-default"
    >
      {/* Left: spacer to balance layout */}
      <div className="flex items-center gap-2 pointer-events-none">
        <div className="w-2 h-2" />
      </div>

      {/* Right: Controls */}
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
            <span className="max-w-[120px] truncate text-right" style={{ direction: 'rtl' }}>{currentModelName}</span>
            {hasModels && (
              <ChevronDown size={12} className={`transition-transform ${isModelDropdownOpen ? "rotate-180" : ""}`} />
            )}
          </button>

          {/* Dropdown Menu */}
          {isModelDropdownOpen && hasModels && (
            <>
              {/* Backdrop to close on click outside */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsModelDropdownOpen(false)}
              />
              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border-subtle rounded-md shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
                {availableModels.map((modelName, index) => (
                  <button
                    key={`${modelName}-${index}`}
                    onClick={() => handleModelSelect(index)}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors truncate ${selectedModelIndex === index
                        ? "text-accent bg-accent-subtle/50"
                        : "text-text-primary hover:bg-surface-hover"
                      }`}
                    title={modelName}
                  >
                    {modelName}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          onClick={onSettings}
          className={`p-1.5 transition-colors rounded-md ${showSettings
            ? "text-accent bg-accent-subtle"
            : "text-text-muted hover:text-text-primary hover:bg-surface-hover"
            }`}
          title="Settings"
        >
          <Settings size={14} />
        </button>
        <button
          onClick={onPin}
          className={`p-1.5 transition-colors rounded-md ${isPinned
            ? "text-accent bg-accent-subtle"
            : "text-text-muted hover:text-text-primary hover:bg-surface-hover"
            }`}
          title={isPinned ? "Unpin window" : "Pin window (Always on Top)"}
        >
          <Pin size={14} className={isPinned ? "fill-accent/20" : ""} />
        </button>
      </div>
    </div>
  );
}
