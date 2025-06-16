import { useEffect, useState } from "react";
import { ChatView } from "./ChatView";
import { useEnhancedSync, useSelectedThread } from "../lib/corrected-sync-engine";

/**
 * IsolatedChatView ensures complete thread isolation
 * by clearing all messages when switching threads
 */
export function IsolatedChatView() {
  const { state } = useEnhancedSync();
  const selectedThread = useSelectedThread();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  
  console.log('[IsolatedChatView] Render:', {
    selectedThreadId: selectedThread?._id,
    currentThreadId,
    stateThreadId: state.selectedThreadId
  });
  
  // Track thread changes and ensure complete isolation
  useEffect(() => {
    if (selectedThread?._id !== currentThreadId) {
      // Thread has changed - ensure complete isolation
      console.log(`[IsolatedChatView] Thread changed from ${currentThreadId} to ${selectedThread?._id}`);
      setCurrentThreadId(selectedThread?._id || null);
    }
  }, [selectedThread?._id, currentThreadId]);
  
  // Force re-render when thread changes to ensure clean state
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