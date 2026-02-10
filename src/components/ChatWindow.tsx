import { useRef, useEffect, useState } from "react";
import { Send, Square, Trash2, Globe, ChevronUp, ChevronDown } from "lucide-react";
import { useChat, type SearchMode } from "../hooks/useChat";
import MessageItem from "./MessageItem";

// Search mode toggle button
function SearchToggle({ mode, onChange }: { mode: SearchMode; onChange: (mode: SearchMode) => void }) {
  const isOn = mode === "on";
  return (
    <button
      type="button"
      onClick={() => onChange(isOn ? "off" : "on")}
      className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-all ${isOn
        ? "bg-accent/10 text-accent border border-accent"
        : "bg-surface text-text-muted border border-border-subtle hover:text-text-primary hover:bg-surface-hover"
        }`}
      title={isOn ? "Web search: On" : "Web search: Off"}
    >
      <Globe size={18} />
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
  const [isExpanded, setIsExpanded] = useState(false);
  const { messages, isStreaming, error, sendMessage, stopStreaming, clearMessages } =
    useChat({ apiPort, searchMode });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = textareaRef.current?.value.trim();
    if (!content || isStreaming) return;

    sendMessage(content);
    textareaRef.current!.value = "";
    // Reset height if expanded
    if (isExpanded) {
      setIsExpanded(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
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
      <div className="border-t border-border-subtle bg-surface-secondary p-3">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          {/* Search Toggle */}
          <SearchToggle mode={searchMode} onChange={setSearchMode} />

          {/* Textarea with expand button */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              placeholder="Type a message..."
              disabled={isStreaming}
              onKeyDown={handleKeyDown}
              className={`w-full px-3 bg-surface border border-border-subtle rounded-md
                       text-text-primary placeholder-text-disabled text-base
                       focus:outline-none focus:border-accent
                       disabled:opacity-50 disabled:cursor-not-allowed
                       resize-none leading-5 block transition-all duration-200 ease-in-out
                       scrollbar-none
                       ${isExpanded ? "h-48 py-2 overflow-y-auto" : "h-10 py-2.5 overflow-hidden"}`}
            />

            {/* Expand/Collapse button */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`absolute right-1 w-8 h-8 flex items-center justify-center rounded-full
                       text-text-muted/60 hover:text-accent transition-all
                       ${isExpanded ? "top-1" : "top-1"}`}
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>

            {/* Streaming indicator */}
            {isStreaming && (
              <span
                className="absolute right-10 top-1/2 -translate-y-1/2 text-accent text-base cursor-blink font-mono"
              >
                ▋
              </span>
            )}
          </div>

          {/* Send/Stop button */}
          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="w-10 h-10 rounded-full bg-error/10 border border-error/30 text-error
                       hover:bg-error/20 transition-colors flex items-center justify-center shrink-0"
              title="Stop"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isStreaming}
              className="w-10 h-10 rounded-full bg-accent text-white
                       hover:bg-accent-hover transition-colors flex items-center justify-center shrink-0
                       disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send"
            >
              <Send size={18} className="ml-0.5" />
            </button>
          )}

          {/* Clear button */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={isStreaming}
              className="w-10 h-10 rounded-full border border-error/30 text-text-muted
                       hover:text-error hover:border-error/50
                       transition-colors flex items-center justify-center shrink-0 disabled:opacity-50"
              title="Clear chat"
            >
              <Trash2 size={16} />
            </button>
          )}
        </form>
      </div>

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-secondary border border-border-subtle p-4 max-w-sm mx-4 rounded-lg">
            <h3 className="text-text-primary font-medium mb-2">Clear Chat?</h3>
            <p className="text-text-muted text-sm mb-4">
              This will delete all messages in the current conversation. This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 text-sm rounded-md text-text-muted hover:text-text-primary border border-border-subtle hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setShowClearConfirm(false);
                }}
                className="px-3 py-1.5 text-sm rounded-md bg-error/10 text-error border border-error/30 hover:bg-error/20 transition-colors"
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
