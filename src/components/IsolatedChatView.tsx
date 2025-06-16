import { useEffect, useState } from "react";
import { ChatView } from "./ChatView";
import { useEnhancedSync, useSelectedThread, useThreads } from "../lib/corrected-sync-engine";
import { MessageCircle } from "lucide-react";

/**
 * IsolatedChatView ensures complete thread isolation
 * by clearing all messages when switching threads
 */
export function IsolatedChatView() {
  const { state, actions } = useEnhancedSync();
  const selectedThread = useSelectedThread();
  const threads = useThreads();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Track thread changes and ensure complete isolation
  useEffect(() => {
    if (selectedThread?._id !== currentThreadId) {
      // Thread has changed - ensure complete isolation
      setCurrentThreadId(selectedThread?._id || null);
    }
  }, [selectedThread?._id, currentThreadId]);
  
  // Handle the case where there are no threads
  if (threads.length === 0 && !state.selectedThreadId) {
    return (
      <div className="c3-chat-container flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 text-[var(--c3-text-muted)]" />
          <h3 className="text-lg font-medium text-[var(--c3-text-secondary)] mb-2">
            No conversations yet
          </h3>
          <p className="text-sm text-[var(--c3-text-tertiary)] mb-6">
            Start a new conversation to begin
          </p>
          <button
            onClick={async () => {
              if (isCreating) return;
              setIsCreating(true);
              try {
                await actions.createThread();
              } finally {
                setIsCreating(false);
              }
            }}
            disabled={isCreating}
            className="c3-button-primary"
          >
            {isCreating ? "Creating..." : "Start New Chat"}
          </button>
        </div>
      </div>
    );
  }
  
  // Show loading state while thread is being selected
  if (!currentThreadId || currentThreadId !== selectedThread?._id) {
    return (
      <div className="c3-chat-container flex items-center justify-center">
        <div className="text-center">
          <div className="c3-typing-indicator mx-auto">
            <div className="c3-typing-dot" />
            <div className="c3-typing-dot" />
            <div className="c3-typing-dot" />
          </div>
          <p className="text-sm text-[var(--c3-text-tertiary)] mt-2">Loading thread...</p>
        </div>
      </div>
    );
  }
  
  // Use key prop to force complete re-render when thread changes
  return <ChatView key={currentThreadId} />;
}