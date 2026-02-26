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
  
  // Track the session ID that initiated the current stream
  // This ensures output goes to the correct tab even if user switches tabs mid-stream
  const streamingSessionIdRef = useRef<string | null>(null);
  
  // Track the currently visible session ID using a ref so it can be accessed 
  // from async callbacks without stale closure issues
  const visibleSessionIdRef = useRef<string>(sessionId);
  
  // Update the ref whenever sessionId changes
  useEffect(() => {
    visibleSessionIdRef.current = sessionId;
  }, [sessionId]);

  // When sessionId changes, load the messages for that session
  useEffect(() => {
    const sessionMessages = messagesMapRef.current.get(sessionId) || [];
    setMessages(sessionMessages);
  }, [sessionId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!apiPort) {
        setError("Sidecar not connected");
        return;
      }

      // Capture the originating session ID to ensure output goes to the right tab
      // even if user switches tabs while waiting for LLM response
      const originatingSessionId = sessionId;
      streamingSessionIdRef.current = originatingSessionId;

      // Add user message
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      // Update messages for the originating session
      const currentMessages = messagesMapRef.current.get(originatingSessionId) || [];
      const messagesWithUser = [...currentMessages, userMessage];
      messagesMapRef.current.set(originatingSessionId, messagesWithUser);
      
      // Only update local state if we're still viewing the originating session
      if (visibleSessionIdRef.current === originatingSessionId) {
        setMessages(messagesWithUser);
      }
      
      setIsStreaming(true);
      setError(null);

      try {
        abortControllerRef.current = new AbortController();

        const response = await fetch(`http://127.0.0.1:${apiPort}/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content, session_id: originatingSessionId, search_mode: searchMode }),
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
        
        // Add assistant placeholder to originating session
        const messagesWithAssistant = [...messagesWithUser, assistantMessage];
        messagesMapRef.current.set(originatingSessionId, messagesWithAssistant);
        
        // Only update local state if we're still viewing the originating session
        if (visibleSessionIdRef.current === originatingSessionId) {
          setMessages(messagesWithAssistant);
        }

        // Stream the response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            
            // Update messages for the originating session
            const currentSessionMessages = messagesMapRef.current.get(originatingSessionId) || [];
            const updatedMessages = currentSessionMessages.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + chunk }
                : msg
            );
            messagesMapRef.current.set(originatingSessionId, updatedMessages);
            
            // Only update local state if we're still viewing the originating session
            if (visibleSessionIdRef.current === originatingSessionId) {
              setMessages(updatedMessages);
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setIsStreaming(false);
        streamingSessionIdRef.current = null;
        abortControllerRef.current = null;
      }
    },
    [apiPort, sessionId, searchMode]
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
