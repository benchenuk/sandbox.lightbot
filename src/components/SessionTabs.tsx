import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { ChatSession } from "../hooks/useChatSessions";

interface SessionTabsProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSwitchSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
}

export default function SessionTabs({
  sessions,
  activeSessionId,
  onSwitchSession,
  onCreateSession,
  onDeleteSession,
}: SessionTabsProps) {
  // Track which session is showing the close button
  const [showingCloseFor, setShowingCloseFor] = useState<string | null>(null);

  const handleDotClick = (sessionId: string) => {
    // If close button is showing for this session, close it
    if (showingCloseFor === sessionId) {
      onDeleteSession(sessionId);
      setShowingCloseFor(null);
    } else {
      // Otherwise just switch to it
      onSwitchSession(sessionId);
    }
  };

  const handleDotContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    // Toggle close button visibility for this session
    setShowingCloseFor((current) => (current === sessionId ? null : sessionId));
  };

  // Close the close button when clicking elsewhere
  const handleContainerClick = () => {
    if (showingCloseFor) {
      setShowingCloseFor(null);
    }
  };

  return (
    <div 
      className="flex items-center gap-2 px-5 py-1.5 border-b border-border-subtle bg-surface"
      onClick={handleContainerClick}
    >
      {/* Session dots */}
      <div className="flex items-center gap-2">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const isShowingClose = showingCloseFor === session.id;
          
          return (
            <button
              key={session.id}
              onClick={(e) => {
                e.stopPropagation();
                handleDotClick(session.id);
              }}
              onContextMenu={(e) => handleDotContextMenu(e, session.id)}
              className={`
                relative flex items-center justify-center rounded-full transition-all duration-150
                ${isActive && !isShowingClose
                  ? "w-3 h-3 ring-2 ring-offset-1 ring-offset-surface ring-current" 
                  : isShowingClose
                  ? "w-5 h-5 bg-surface-hover border border-border-subtle"
                  : "w-2 h-2 hover:scale-125"
                }
              `}
              style={{
                backgroundColor: isShowingClose ? undefined : session.color,
                color: session.color, // Used for ring color when active
              }}
              title={
                isShowingClose 
                  ? "Click to close this session" 
                  : isActive 
                  ? "Current session (right-click to close)" 
                  : "Switch to this session (right-click to close)"
              }
            >
              {isShowingClose && (
                <X 
                  size={12} 
                  className="text-error"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* New session button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCreateSession();
        }}
        className="flex items-center justify-center w-5 h-5 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
        title="New session"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
