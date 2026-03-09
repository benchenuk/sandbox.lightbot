import { useState, useMemo } from "react";
import { Copy, Check, Clipboard, Brain, User, Sparkles } from "lucide-react";
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
  retainThinking?: boolean;
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

export default function MessageItem({ message, searchQuery = "", apiPort, sessionId = "default", retainThinking = true }: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [showClipModal, setShowClipModal] = useState(false);
  const isUser = message.role === "user";
  const { clipMessage } = useClip({ apiPort });

  // Compute actual content to show/copy/clip
  const { displayContent, hasThinking, isStillThinking, thinkContent } = useMemo(() => {
    const thinkMatch = message.content.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
    const hasThinking = !!thinkMatch;
    const isStillThinking = hasThinking && !message.content.includes("</think>");
    const thinkContent = thinkMatch ? thinkMatch[1].trim() : "";

    // If not retaining, remove the think block completely
    const displayContent = retainThinking
      ? message.content
      : message.content.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<think>[\s\S]*?$/, "").trim();

    return { displayContent, hasThinking, isStillThinking, thinkContent };
  }, [message.content, retainThinking]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClip = async (title: string, tags: string[]) => {
    return await clipMessage(title, tags, displayContent);
  };

  // For user messages, render with highlighting
  const renderUserContent = () => {
    if (!searchQuery.trim()) return displayContent;

    // Split by newlines and highlight each line
    const lines = displayContent.split('\n');
    return lines.map((line, lineIndex) => (
      <span key={lineIndex}>
        <HighlightText text={line} query={searchQuery} />
        {lineIndex < lines.length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div
      className={`group border-b border-border-subtle ${isUser ? 'bg-surface' : 'bg-surface-secondary/50'
        }`}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle/30">
        <div className="flex items-center gap-3">
          <div className={`p-1 rounded ${isUser ? "bg-surface-tertiary text-text-secondary" : "bg-accent/10 text-accent"}`}>
            {isUser ? <User size={14} /> : <Sparkles size={14} />}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-disabled text-xs font-mono">
              {message.timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            {/* Thinking Indicator in Header */}
            {!isUser && hasThinking && (
              <div className="flex items-center ml-1" title={isStillThinking ? "Thinking..." : "Thought complete"}>
                <Brain
                  size={12}
                  className={`${isStillThinking ? "text-accent animate-pulse" : "text-text-disabled opacity-50"} transition-all`}
                />
              </div>
            )}
          </div>
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
      <div className="px-4 py-3">
        {isUser ? (
          <p className="text-text-primary text-base leading-relaxed whitespace-pre-wrap">
            {renderUserContent()}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Reasoning Block - Only visible if fully retained */}
            {retainThinking && thinkContent && (
              <div className="mb-3 p-3 bg-surface-tertiary/30 border-l-2 border-accent/30 rounded-r-md text-sm italic text-text-muted">
                <div className="flex items-center gap-2 mb-1 not-italic font-medium text-xs uppercase tracking-wider text-accent opacity-70">
                  <Brain size={12} />
                  <span>Reasoning</span>
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">
                  {thinkContent}
                </div>
              </div>
            )}

            {/* Main Content - Always strip think tags for display since they have their own block */}
            <div className="markdown text-text-primary text-base">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={createHighlightComponents(searchQuery)}
              >
                {displayContent.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, "").trim()}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Clip Modal */}
      <ClipModal
        isOpen={showClipModal}
        onClose={() => setShowClipModal(false)}
        content={displayContent}
        onClip={handleClip}
        sessionId={sessionId}
      />
    </div>
  );
}
