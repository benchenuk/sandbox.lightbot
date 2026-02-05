import { useState } from "react";
import { Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "../hooks/useChat";

interface MessageItemProps {
  message: Message;
}

export default function MessageItem({ message }: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`group border-b border-border-subtle ${isUser ? 'bg-surface' : 'bg-surface-secondary/50'}`}>
      {/* Header with role and timestamp */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium uppercase tracking-wider ${isUser ? "text-text-secondary" : "text-accent"}`}>
            {isUser ? "You" : "Assistant"}
          </span>
          <span className="text-text-disabled text-sm">
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        
        {/* Copy Button - only for assistant messages */}
        {!isUser && (
          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
            title="Copy"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        {isUser ? (
          <p className="text-text-primary text-base leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="markdown text-text-primary text-base">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
