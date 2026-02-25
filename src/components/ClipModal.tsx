import { useState, useEffect, useRef, useCallback } from "react";
import { useClipHistory } from "../contexts/ClipContext";

interface ClipModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onClip: (title: string, tags: string[]) => Promise<{ success: boolean; error?: string }>;
  sessionId: string;
}

export default function ClipModal({ isOpen, onClose, content, onClip, sessionId }: ClipModalProps) {
  const { getHistory, addToHistory } = useClipHistory();
  const [title, setTitle] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const history = getHistory(sessionId);

  const defaultTitle = history.length > 0 ? history[history.length - 1] : "";

  useEffect(() => {
    if (isOpen) {
      setTitle(defaultTitle);
      setHistoryIndex(-1);
      setTagsInput("");
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [isOpen, defaultTitle]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex <= 0 ? history.length - 1 : historyIndex - 1;
        setHistoryIndex(newIndex);
        setTitle(history[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex < 0 ? 0 : (historyIndex + 1) % history.length;
        setHistoryIndex(newIndex);
        setTitle(history[newIndex]);
      }
    }
  }, [history, historyIndex]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    const tags = tagsInput.split(",").map((t) => t.trim()).filter((t) => t);
    const result = await onClip(title, tags);

    if (result.success) {
      addToHistory(sessionId, title);
      setTitle("");
      setTagsInput("");
      onClose();
    } else {
      alert(result.error || "Failed to clip message");
    }
    setIsSubmitting(false);
  };

  const tags = tagsInput.split(",").map((t) => t.trim()).filter((t) => t);
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
      <div className="bg-surface-secondary border border-border-subtle p-5 w-80 rounded-xl shadow-2xl">
        <h3 className="text-text-primary font-medium mb-4">Clip Message</h3>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-text-muted text-sm mb-1.5">Title</label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setHistoryIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              placeholder={defaultTitle || "Enter title..."}
              className="w-full px-3 py-2 bg-surface border border-border-subtle rounded-md text-text-primary text-sm placeholder:text-text-disabled focus:outline-none focus:border-accent"
            />
            <p className="text-text-disabled text-xs mt-1">Same name clips are appended</p>
          </div>

          <div className="mb-4">
            <label className="block text-text-muted text-sm mb-1.5">Tags (comma separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="ai, llm, note..."
              className="w-full px-3 py-2 bg-surface border border-border-subtle rounded-md text-text-primary text-sm placeholder:text-text-disabled focus:outline-none focus:border-accent"
            />
          </div>

          <div className="mb-4 p-3 bg-surface rounded-md">
            <p className="text-text-muted text-xs mb-2">Preview:</p>
            <pre className="text-text-primary text-xs font-mono whitespace-pre-wrap">
{`---
title: "${title || "..."}"
created: "${today}"
tags:${tags.map((t) => `\n  - ${t}`).join("")}
source: 
---

${content.slice(0, 100)}${content.length > 100 ? "..." : ""}`}
            </pre>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-md text-text-muted hover:text-text-primary border border-border-subtle hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Clipping..." : "Clip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
