import { useRef, useEffect } from "react";
import { Send, Square, Trash2 } from "lucide-react";
import { useChat } from "../hooks/useChat";
import MessageItem from "./MessageItem";

interface ChatWindowProps {
  apiPort: number | null;
}

export default function ChatWindow({ apiPort }: ChatWindowProps) {
  const { messages, isStreaming, error, sendMessage, stopStreaming, clearMessages } =
    useChat({ apiPort });
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
            <div className="text-3xl mb-3 opacity-30 font-mono">⌘</div>
            <p className="text-md font-medium">LightBot</p>
            <p className="text-xs mt-2 opacity-60">
              Press Command+Shift+O to toggle from anywhere
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
        <form onSubmit={handleSubmit} className="p-3 flex gap-2">
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
              className="px-2.5 py-1.5 bg-error/10 border border-error/30 text-error
                       hover:bg-error/20 transition-colors flex items-center justify-center"
              title="Stop"
            >
              <Square size={12} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isStreaming}
              className="px-2.5 py-1.5 bg-accent text-white
                       hover:bg-accent-hover transition-colors flex items-center justify-center
                       disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send"
            >
              <Send size={12} />
            </button>
          )}

          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearMessages}
              disabled={isStreaming}
              className="px-2.5 py-1.5 border border-border-primary text-text-muted
                       hover:text-text-primary hover:border-text-muted
                       transition-colors flex items-center justify-center disabled:opacity-50"
              title="Clear chat"
            >
              <Trash2 size={12} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
