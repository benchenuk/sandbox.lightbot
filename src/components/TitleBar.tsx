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
      className="h-9 flex items-center justify-between px-3 border-b border-border-subtle bg-surface select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left: Title */}
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <div className="w-2 h-2 bg-accent rounded-full" />
        <span className="text-text-primary font-medium text-base tracking-tight">LightBot</span>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button
          onClick={onSettings}
          className={`p-1.5 transition-colors ${
            showSettings
              ? "text-accent bg-accent-subtle"
              : "text-text-muted hover:text-text-primary hover:bg-surface-hover"
          }`}
          title="Settings"
        >
          <Settings size={14} />
        </button>
        <button
          onClick={onMinimize}
          className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 text-text-muted hover:text-error hover:bg-error/10 transition-colors"
          title="Hide"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
