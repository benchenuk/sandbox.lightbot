import { useState, useCallback } from "react";

// Predefined color palette for tab indicators
const TAB_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];

export interface ChatSession {
  id: string;
  color: string;
  createdAt: Date;
}

interface UseChatSessionsReturn {
  sessions: ChatSession[];
  activeSessionId: string;
  createSession: () => void;
  deleteSession: (id: string) => void;
  switchSession: (id: string) => void;
}

function generateSessionId(): string {
  return crypto.randomUUID();
}

function getColorForIndex(index: number): string {
  return TAB_COLORS[index % TAB_COLORS.length];
}

export function useChatSessions(): UseChatSessionsReturn {
  // Initialize with a single default session
  const initialSession: ChatSession = {
    id: generateSessionId(),
    color: TAB_COLORS[0],
    createdAt: new Date(),
  };

  const [sessions, setSessions] = useState<ChatSession[]>([initialSession]);
  const [activeSessionId, setActiveSessionId] = useState<string>(initialSession.id);

  const createSession = useCallback(() => {
    // Get the last session's color to avoid duplication
    const lastColor = sessions.length > 0 ? sessions[sessions.length - 1].color : null;
    const nextIndex = sessions.length;
    let color = getColorForIndex(nextIndex);
    
    // If the calculated color is the same as the last one, use the next one
    if (color === lastColor) {
      color = getColorForIndex(nextIndex + 1);
    }
    
    const newSession: ChatSession = {
      id: generateSessionId(),
      color,
      createdAt: new Date(),
    };
    setSessions((prev) => [...prev, newSession]);
    setActiveSessionId(newSession.id);
  }, [sessions]);

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const newSessions = prev.filter((s) => s.id !== id);

        // If deleting the last session, create a new one
        if (newSessions.length === 0) {
          const newSession: ChatSession = {
            id: generateSessionId(),
            color: TAB_COLORS[0],
            createdAt: new Date(),
          };
          setActiveSessionId(newSession.id);
          return [newSession];
        }

        // If deleting the active session, switch to another
        if (id === activeSessionId) {
          const index = prev.findIndex((s) => s.id === id);
          const newIndex = index > 0 ? index - 1 : 0;
          setActiveSessionId(newSessions[newIndex].id);
        }

        return newSessions;
      });
    },
    [activeSessionId]
  );

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  return {
    sessions,
    activeSessionId,
    createSession,
    deleteSession,
    switchSession,
  };
}
