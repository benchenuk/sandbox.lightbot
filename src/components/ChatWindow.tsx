import { useRef, useEffect, useState } from "react";
import { Send, Square, Trash2, Globe } from "lucide-react";
import { useChat, type SearchMode } from "../hooks/useChat";
import MessageItem from "./MessageItem";

// Search mode toggle button
function SearchToggle({ mode, onChange }: { mode: SearchMode; onChange: (mode: SearchMode) => void }) {
  const isOn = mode === "on";
  return (
    <button
      type="button"
      onClick={() => onChange(isOn ? "off" : "on")}
      className={`w-9 h-9 shrink-0 flex items-center justify-center transition-colors ${isOn
        ? "bg-accent/10 text-accent border border-accent"
        : "bg-surface text-text-muted border border-border-subtle hover:text-text-primary hover:bg-surface-hover"
        }`}
      title={isOn ? "Web search: On" : "Web search: Off"}
    >
      <Globe size={16} />
    </button>
  );
}

interface ChatWindowProps {
  apiPort: number | null;
  hotkey: string;
}

export default function ChatWindow({ apiPort, hotkey }: ChatWindowProps) {
  const [searchMode, setSearchMode] = useState<SearchMode>("off");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { messages, isStreaming, error, sendMessage, stopStreaming, clearMessages } =
    useChat({ apiPort, searchMode });
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Format hotkey for display
  const displayHotkey = hotkey
    .replace(/Command|Cmd/gi, "⌘")
    .replace(/Shift/gi, "⇧")
    .replace(/Option|Alt/gi, "⌥")
    .replace(/Control|Ctrl/gi, "⌃")
    .replace(/\+/g, "");

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = inputRef.current?.value.trim();
    if (!content || isStreaming) return;

    sendMessage(content);
    inputRef.current!.value = "";
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-text-muted">
            <div className="text-3xl mb-3 opacity-30 font-mono">💡</div>
            <p className="text-md font-medium">LightBot</p>
            <p className="text-xs mt-2 opacity-60">
              Press {displayHotkey} to toggle from anywhere
            </p>
            <p className="text-xs mt-2 opacity-60">
              Chat session is ephemeral
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-3 mb-2 px-3 py-1.5 bg-error/10 border-t border-error/30 text-error text-base">
          {error}
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-border-subtle bg-surface-secondary">
        <form onSubmit={handleSubmit} className="p-3 flex items-center gap-2">
          {/* Search Toggle */}
          <SearchToggle mode={searchMode} onChange={setSearchMode} />
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a message..."
              disabled={isStreaming}
              className="w-full px-3 py-1.5 bg-surface border border-border-subtle
                       text-text-primary placeholder-text-disabled text-base
                       focus:outline-none focus:border-accent
                       disabled:opacity-50 disabled:cursor-not-allowed
                       font-sans"
            />
            {isStreaming && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-accent text-base cursor-blink font-mono">
                ▋
              </span>
            )}
          </div>

          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="w-9 h-9 shrink-0 bg-error/10 border border-error/30 text-error
                       hover:bg-error/20 transition-colors flex items-center justify-center"
              title="Stop"
            >
              <Square size={12} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isStreaming}
              className="w-9 h-9 shrink-0 bg-accent text-white
                       hover:bg-accent-hover transition-colors flex items-center justify-center
                       disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send"
            >
              <Send size={12} className="ml-0.5" />
            </button>
          )}

          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={isStreaming}
              className="w-9 h-9 shrink-0 border border-error/30 text-text-muted
                       hover:text-error hover:border-error/50
                       transition-colors flex items-center justify-center disabled:opacity-50"
              title="Clear chat"
            >
              <Trash2 size={12} />
            </button>
          )}
        </form>
      </div>

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-secondary border border-border-subtle p-4 max-w-sm mx-4">
            <h3 className="text-text-primary font-medium mb-2">Clear Chat?</h3>
            <p className="text-text-muted text-sm mb-4">
              This will delete all messages in the current conversation. This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 text-sm text-text-muted hover:text-text-primary border border-border-subtle hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setShowClearConfirm(false);
                }}
                className="px-3 py-1.5 text-sm bg-error/10 text-error border border-error/30 hover:bg-error/20 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
