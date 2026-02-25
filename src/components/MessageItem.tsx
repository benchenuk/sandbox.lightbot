import { useState, useMemo } from "react";
import { Copy, Check, Clipboard } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from 'react-markdown';
import type { Message } from "../hooks/useChat";
import { useClip } from "../hooks/useClip";
import ClipModal from "./ClipModal";

interface MessageItemProps {
  message: Message;
  searchQuery?: string;
  apiPort: number | null;
  sessionId?: string;
}

// Highlight matching text in a string - highlights ALL occurrences
function HighlightText({ text, query }: { text: string; query: string }) {
  const parts = useMemo(() => {
    if (!query.trim()) return [{ text, isMatch: false }];
    
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const splitParts = text.split(regex);
    
    // Filter out empty strings and mark matches
    return splitParts
      .filter(part => part.length > 0)
      .map((part) => ({
        text: part,
        isMatch: part.toLowerCase() === query.toLowerCase(),
      }));
  }, [text, query]);

  return (
    <>
      {parts.map((part, index) =>
        part.isMatch ? (
          <mark
            key={index}
            className="bg-yellow-400/80 text-black rounded px-0.5 font-medium"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  );
}

// Custom components that wrap text nodes with highlighting
function createHighlightComponents(query: string): Components {
  if (!query.trim()) return {};
  
  const HighlightWrapper = ({ children }: { children: React.ReactNode }) => {
    if (typeof children === 'string') {
      return <HighlightText text={children} query={query} />;
    }
    if (Array.isArray(children)) {
      return (
        <>
          {children.map((child, i) => 
            typeof child === 'string' 
              ? <HighlightText key={i} text={child} query={query} />
              : <span key={i}>{child}</span>
          )}
        </>
      );
    }
    return <>{children}</>;
  };
  
  return {
    p: ({ children }) => (
      <p className="mb-2 last:mb-0"><HighlightWrapper>{children}</HighlightWrapper></p>
    ),
    li: ({ children }) => (
      <li><HighlightWrapper>{children}</HighlightWrapper></li>
    ),
    strong: ({ children }) => (
      <strong><HighlightWrapper>{children}</HighlightWrapper></strong>
    ),
    em: ({ children }) => (
      <em><HighlightWrapper>{children}</HighlightWrapper></em>
    ),
    code: ({ children }) => {
      const isInline = !children?.toString().includes('\n');
      if (isInline) {
        return <code className="bg-surface-secondary px-1 py-0.5 rounded text-sm"><HighlightWrapper>{children}</HighlightWrapper></code>;
      }
      return <code>{children}</code>;
    },
  };
}

export default function MessageItem({ message, searchQuery = "", apiPort, sessionId = "default" }: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [showClipModal, setShowClipModal] = useState(false);
  const isUser = message.role === "user";
  const { clipMessage } = useClip({ apiPort });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClip = async (title: string, tags: string[]) => {
    return await clipMessage(title, tags, message.content);
  };

  // For user messages, render with highlighting
  const renderUserContent = () => {
    if (!searchQuery.trim()) return message.content;
    
    // Split by newlines and highlight each line
    const lines = message.content.split('\n');
    return lines.map((line, lineIndex) => (
      <span key={lineIndex}>
        <HighlightText text={line} query={searchQuery} />
        {lineIndex < lines.length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div 
      className={`group border-b border-border-subtle ${
        isUser ? 'bg-surface' : 'bg-surface-secondary/50'
      }`}
    >
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
        
        {/* Copy Button */}
        <div className="flex items-center gap-1">
          {!isUser && (
            <button
              onClick={() => setShowClipModal(true)}
              className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
              title="Clip"
            >
              <Clipboard size={12} />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
            title="Copy"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        {isUser ? (
          <p className="text-text-primary text-base leading-relaxed whitespace-pre-wrap">
            {renderUserContent()}
          </p>
        ) : (
          <div className="markdown text-text-primary text-base">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={createHighlightComponents(searchQuery)}
            >
              {message.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, "").trim()}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Clip Modal */}
      <ClipModal
        isOpen={showClipModal}
        onClose={() => setShowClipModal(false)}
        content={message.content}
        onClip={handleClip}
        sessionId={sessionId}
      />
    </div>
  );
}
