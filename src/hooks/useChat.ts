import { useState, useCallback, useRef, useEffect } from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export type SearchMode = "off" | "on" | "auto";

interface UseChatOptions {
  apiPort: number | null;
  sessionId?: string;
  searchMode?: SearchMode;
}

export function useChat({ apiPort, sessionId = "default", searchMode = "off" }: UseChatOptions) {
  // Use a ref to store messages for all sessions
  const messagesMapRef = useRef<Map<string, Message[]>>(new Map());
  
  // Local state for current session's messages
  const [messages, setMessages] = useState<Message[]>(() => {
    return messagesMapRef.current.get(sessionId) || [];
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // When sessionId changes, load the messages for that session
  useEffect(() => {
    const sessionMessages = messagesMapRef.current.get(sessionId) || [];
    setMessages(sessionMessages);
  }, [sessionId]);

  // Helper to update both local state and the map
  const updateMessages = useCallback((newMessages: Message[] | ((prev: Message[]) => Message[])) => {
    setMessages((prev) => {
      const updated = typeof newMessages === "function" ? newMessages(prev) : newMessages;
      messagesMapRef.current.set(sessionId, updated);
      return updated;
    });
  }, [sessionId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!apiPort) {
        setError("Sidecar not connected");
        return;
      }

      // Add user message
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      updateMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);
      setError(null);

      try {
        abortControllerRef.current = new AbortController();

        const response = await fetch(`http://127.0.0.1:${apiPort}/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content, session_id: sessionId, search_mode: searchMode }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Create assistant message placeholder
        const assistantMessageId = crypto.randomUUID();
        const assistantMessage: Message = {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
        };
        updateMessages((prev) => [...prev, assistantMessage]);

        // Stream the response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            updateMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content + chunk }
                  : msg
              )
            );
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [apiPort, sessionId, searchMode, updateMessages]
  );

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clearMessages = useCallback(async () => {
    setMessages([]);
    messagesMapRef.current.set(sessionId, []);
    setError(null);

    if (apiPort) {
      try {
        await fetch(`http://127.0.0.1:${apiPort}/chat/clear?session_id=${sessionId}`, {
          method: "POST",
        });
      } catch {
        // Ignore error on clear
      }
    }
  }, [apiPort, sessionId]);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
  };
}
