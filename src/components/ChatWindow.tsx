import { useRef, useEffect } from "react";
import { Send, Square, Trash2 } from "lucide-react";
import { useChat } from "../hooks/useChat";
import MessageBubble from "./MessageBubble";

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
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-terminal-dim">
            <div className="text-4xl mb-4 opacity-50">⌘</div>
            <p className="text-sm">Welcome to LightBot</p>
            <p className="text-xs mt-1 opacity-70">
              Press Command+Shift+O to toggle from anywhere
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 bg-terminal-error/10 border border-terminal-error/30 rounded text-terminal-error text-sm">
          {error}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-terminal-border">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a message..."
              disabled={isStreaming}
              className="w-full px-4 py-2.5 bg-terminal-bg border border-terminal-border rounded-lg 
                       text-terminal-fg placeholder-terminal-dim
                       focus:outline-none focus:border-terminal-accent focus:ring-1 focus:ring-terminal-accent
                       disabled:opacity-50 disabled:cursor-not-allowed
                       text-sm"
            />
            {isStreaming && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-terminal-accent text-xs cursor-blink">
                ▋
              </span>
            )}
          </div>

          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="px-4 py-2 bg-terminal-error/10 border border-terminal-error/30 text-terminal-error 
                       rounded-lg hover:bg-terminal-error/20 transition-colors"
              title="Stop"
            >
              <Square size={18} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isStreaming}
              className="px-4 py-2 bg-terminal-accent text-terminal-bg 
                       rounded-lg hover:bg-terminal-accent/90 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send"
            >
              <Send size={18} />
            </button>
          )}

          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearMessages}
              disabled={isStreaming}
              className="px-3 py-2 border border-terminal-border text-terminal-dim 
                       rounded-lg hover:text-terminal-fg hover:border-terminal-fg/50 
                       transition-colors disabled:opacity-50"
              title="Clear chat"
            >
              <Trash2 size={18} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
