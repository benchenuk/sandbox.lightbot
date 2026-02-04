import { useState } from "react";
import { Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "../hooks/useChat";

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`group flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] relative ${
          isUser
            ? "bg-terminal-secondary/20 border border-terminal-secondary/30"
            : "bg-terminal-border/30 border border-terminal-border"
        } rounded-lg px-4 py-3`}
      >
        {/* Role Indicator */}
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-xs font-medium ${
              isUser ? "text-terminal-secondary" : "text-terminal-accent"
            }`}
          >
            {isUser ? "You" : "LightBot"}
          </span>
          <span className="text-terminal-dim text-xs">
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Content */}
        <div className="text-sm text-terminal-fg">
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded opacity-0 group-hover:opacity-100 
                   text-terminal-dim hover:text-terminal-fg hover:bg-terminal-border 
                   transition-all"
          title="Copy"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}
