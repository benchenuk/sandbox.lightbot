import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Send, Square, Trash2, Globe, ChevronUp, ChevronDown, Search, X } from "lucide-react";
import { useChat, type SearchMode } from "../hooks/useChat";
import MessageItem from "./MessageItem";

// Search mode toggle button
function SearchToggle({ mode, onChange }: { mode: SearchMode; onChange: (mode: SearchMode) => void }) {
  const isOn = mode === "on";
  return (
    <button
      type="button"
      onClick={() => onChange(isOn ? "off" : "on")}
      className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-all ${isOn
        ? "bg-accent/10 text-accent border border-accent shadow-sm shadow-accent/10"
        : "bg-surface text-text-muted border border-border-subtle hover:text-text-primary hover:bg-surface-hover shadow-sm"
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
  fontSize?: "small" | "medium" | "large";
  sessionId?: string;
}

// Threshold in pixels for considering the user at the bottom
const SCROLL_BOTTOM_THRESHOLD = 50;

export default function ChatWindow({ apiPort, hotkey, fontSize = "medium", sessionId }: ChatWindowProps) {
  const [searchMode, setSearchMode] = useState<SearchMode>("off");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { messages, isStreaming, error, sendMessage, stopStreaming, clearMessages } =
    useChat({ apiPort, searchMode, sessionId });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Filter messages based on search query (case-insensitive)
  const filteredMessages = useMemo(() => {
    if (!chatSearchQuery.trim() || !isSearchOpen) return messages;
    const queryLower = chatSearchQuery.toLowerCase();
    return messages.filter((msg) => msg.content.toLowerCase().includes(queryLower));
  }, [messages, chatSearchQuery, isSearchOpen]);

  // Format hotkey for display
  const displayHotkey = hotkey
    .replace(/Command|Cmd/gi, "⌘")
    .replace(/Shift/gi, "⇧")
    .replace(/Option|Alt/gi, "⌥")
    .replace(/Control|Ctrl/gi, "⌃")
    .replace(/\+/g, "");

  // Check if the user is near the bottom of the scroll container
  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight < SCROLL_BOTTOM_THRESHOLD;
  }, []);

  // Handle scroll events to detect user-initiated scroll
  const handleScroll = useCallback(() => {
    const nearBottom = isNearBottom();
    setIsUserScrolledUp(!nearBottom);
  }, [isNearBottom]);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Auto-scroll to bottom only if user hasn't scrolled up
  useEffect(() => {
    if (!isUserScrolledUp) {
      scrollToBottom("smooth");
    }
  }, [messages, isUserScrolledUp, scrollToBottom]);

  // Focus input on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Keyboard shortcut: Cmd/Ctrl+F to toggle search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        if (isSearchOpen) {
          // If already open, focus the input
          searchInputRef.current?.focus();
        } else {
          // Open search
          setIsSearchOpen(true);
          // Focus after render
          setTimeout(() => searchInputRef.current?.focus(), 10);
        }
      }
      if (e.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
        setChatSearchQuery("");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen]);

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
    if (e.key === "Enter") {
      if (e.shiftKey) {
        // Allow default newline behavior but ensure it's expanded
        setIsExpanded(true);
      } else {
        e.preventDefault();
        handleSubmit(e);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Messages Area - Font size only affects chat content */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto relative font-size-${fontSize}`}>

        {/* Chat Search Bar - Hidden by default, shown via Cmd+F */}
        {isSearchOpen && messages.length > 0 && (
          <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur-sm border-b border-border-subtle px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  placeholder="Search in chat..."
                  className="w-full pl-8 pr-16 py-1.5 bg-surface-secondary border border-border-subtle rounded-lg
                           text-sm text-text-primary placeholder-text-disabled
                           focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
                />
                {chatSearchQuery && (
                  <button
                    onClick={() => setChatSearchQuery("")}
                    className="absolute right-8 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    <X size={14} />
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsSearchOpen(false);
                    setChatSearchQuery("");
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  title="Close (ESC)"
                >
                  <span className="text-xs">ESC</span>
                </button>
              </div>
            </div>
          </div>
        )}

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
        ) : filteredMessages.length === 0 && isSearchOpen ? (
          <div className="h-full flex flex-col items-center justify-center text-text-muted py-12">
            <Search size={24} className="opacity-30 mb-2" />
            <p className="text-sm">No messages match "{chatSearchQuery}"</p>
            <button
              onClick={() => setChatSearchQuery("")}
              className="mt-2 text-xs text-accent hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          filteredMessages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              searchQuery={isSearchOpen ? chatSearchQuery : ""}
            />
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
      <div className="relative border-t border-border-subtle/50 bg-surface-secondary/80 backdrop-blur-md p-4">
        {/* Subtle top gradient highlight for the premium border feel */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />

        <form onSubmit={handleSubmit} className="flex items-end gap-3 max-w-4xl mx-auto">
          {/* Search Toggle */}
          <div className="flex-none">
            <SearchToggle mode={searchMode} onChange={setSearchMode} />
          </div>

          {/* Textarea with integrated controls */}
          <div className="flex-1 relative group/input">
            <textarea
              ref={textareaRef}
              placeholder="Type a message..."
              disabled={isStreaming}
              onKeyDown={handleKeyDown}
              className={`w-full px-4 bg-surface/50 border border-border-subtle rounded-2xl
                       text-text-primary placeholder-text-disabled/50 text-base
                       focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20
                       disabled:opacity-50 disabled:cursor-not-allowed
                       resize-none leading-relaxed block transition-all duration-300 ease-in-out
                       scrollbar-none shadow-inner
                       ${isExpanded ? "h-64 py-3 overflow-y-auto" : "h-11 py-2.5 overflow-hidden"}`}
            />

            {/* Expand/Collapse button - Floating feel */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`absolute right-1.5 w-8 h-8 flex items-center justify-center rounded-full
                       text-text-muted/40 hover:text-accent hover:bg-accent/5 transition-all
                       hover:scale-110 active:scale-90
                       ${isExpanded ? "top-1.5" : "top-1.5"}`}
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>

            {/* Streaming indicator */}
            {isStreaming && (
              <span
                className="absolute right-11 top-1/2 -translate-y-1/2 text-accent text-base cursor-blink font-mono opacity-80"
              >
                ▋
              </span>
            )}
          </div>

          {/* Action Row: Send & Clear */}
          <div className="flex-none flex items-center gap-2">
            {isStreaming ? (
              <button
                type="button"
                onClick={stopStreaming}
                className="w-11 h-11 rounded-full bg-error/10 border border-error/20 text-error
                         hover:bg-error/20 hover:scale-105 active:scale-95 
                         transition-all flex items-center justify-center shadow-lg shadow-error/5"
                title="Stop"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isStreaming}
                className="w-11 h-11 rounded-full bg-gradient-to-tr from-accent to-accent-hover text-white
                         hover:shadow-lg hover:shadow-accent/30 hover:scale-105 active:scale-95 
                         transition-all flex items-center justify-center
                         disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                title="Send"
              >
                <Send size={18} className="ml-0.5" />
              </button>
            )}

            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                disabled={isStreaming}
                className="w-11 h-11 rounded-full border border-border-subtle bg-surface/30 text-text-muted
                         hover:text-error hover:border-error/30 hover:bg-error/5
                         hover:scale-105 active:scale-95
                         transition-all flex items-center justify-center disabled:opacity-50"
                title="Clear chat"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <div className={`absolute inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-[1px] transition-all duration-300 ${isExpanded ? "pb-80" : "pb-32"}`}>
          <div className="bg-surface-secondary border border-border-subtle p-5 max-w-sm mx-4 rounded-xl shadow-2xl transition-all">
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
