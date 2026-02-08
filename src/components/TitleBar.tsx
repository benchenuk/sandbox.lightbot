import { Settings, Pin } from "lucide-react";

interface TitleBarProps {
  onSettings: () => void;
  showSettings: boolean;
  isPinned: boolean;
  onPin: () => void;
}

export default function TitleBar({
  onSettings,
  showSettings,
  isPinned,
  onPin,
}: TitleBarProps) {
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
