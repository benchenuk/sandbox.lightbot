import { Settings, Minus, X } from "lucide-react";

interface TitleBarProps {
  onClose: () => void;
  onMinimize: () => void;
  onSettings: () => void;
  showSettings: boolean;
}

export default function TitleBar({
  onClose,
  onMinimize,
  onSettings,
  showSettings,
}: TitleBarProps) {
  return (
    <div
      data-tauri-drag-region
      className="h-10 flex items-center justify-between px-4 border-b border-terminal-border select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left: Title */}
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <span className="text-terminal-accent font-bold text-sm">●</span>
        <span className="text-terminal-fg font-medium text-sm">LightBot</span>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button
          onClick={onSettings}
          className={`p-2 rounded-md transition-colors ${
            showSettings
              ? "text-terminal-accent bg-terminal-accent/10"
              : "text-terminal-dim hover:text-terminal-fg hover:bg-terminal-border"
          }`}
          title="Settings"
        >
          <Settings size={16} />
        </button>
        <button
          onClick={onMinimize}
          className="p-2 rounded-md text-terminal-dim hover:text-terminal-fg hover:bg-terminal-border transition-colors"
          title="Minimize"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={onClose}
          className="p-2 rounded-md text-terminal-dim hover:text-terminal-error hover:bg-terminal-error/10 transition-colors"
          title="Hide"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
