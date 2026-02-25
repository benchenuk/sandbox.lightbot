import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ClipContextValue {
  getHistory: (sessionId: string) => string[];
  addToHistory: (sessionId: string, title: string) => void;
}

const ClipContext = createContext<ClipContextValue | null>(null);

export function ClipProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<Record<string, string[]>>({});

  const getHistory = useCallback((sessionId: string) => {
    return history[sessionId] || [];
  }, [history]);

  const addToHistory = useCallback((sessionId: string, title: string) => {
    setHistory((prev) => {
      const sessionHistory = prev[sessionId] || [];
      if (sessionHistory.includes(title)) return prev;
      return { ...prev, [sessionId]: [...sessionHistory, title] };
    });
  }, []);

  return (
    <ClipContext.Provider value={{ getHistory, addToHistory }}>
      {children}
    </ClipContext.Provider>
  );
}

export function useClipHistory() {
  const context = useContext(ClipContext);
  if (!context) {
    throw new Error("useClipHistory must be used within ClipProvider");
  }
  return context;
}
