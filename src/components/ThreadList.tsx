import { useState } from "react";
import { toast } from "sonner";
import { useEnhancedSync, useThreads, useOnlineStatus, useSyncStatus } from "../lib/corrected-sync-engine";

export function ThreadList() {
  const { state, actions } = useEnhancedSync();
  const threads = useThreads();
  const isOnline = useOnlineStatus();
  const syncStatus = useSyncStatus();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateThread = async () => {
    if (isCreating) return;
    
    setIsCreating(true);
    try {
      const threadId = await actions.createThread();
      toast.success("New chat created!");
    } catch (error) {
      toast.error("Failed to create chat");
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectThread = async (threadId: string) => {
    try {
      await actions.selectThread(threadId);
    } catch (error) {
      toast.error("Failed to open chat");
      console.error(error);
    }
  };

  const handleDeleteThread = async (threadId: string, threadTitle: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent thread selection
    
    if (!confirm(`Delete "${threadTitle}"? This cannot be undone.`)) return;
    
    try {
      await actions.deleteThread(threadId);
      toast.success("Chat deleted");
    } catch (error) {
      toast.error("Failed to delete chat");
      console.error(error);
    }
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    
    if (diff < minute) return "Just now";
    if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
    if (diff < day) return `${Math.floor(diff / hour)}h ago`;
    if (diff < week) return `${Math.floor(diff / day)}d ago`;
    
    return new Date(timestamp).toLocaleDateString();
  };

  const getThreadPreview = (thread: any) => {
    // For optimistic threads, show a preview
    if (thread.isOptimistic) {
      return "Starting new conversation...";
    }
    
    // For threads with local changes, indicate pending sync
    if (thread.hasLocalChanges) {
      return "💾 Syncing changes...";
    }
    
    return "Click to open conversation";
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Chats</h3>
          <div className="flex items-center gap-2">
            {/* Sync status indicator */}
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full transition-colors ${
                isOnline ? 'bg-green-400' : 'bg-red-400'
              }`} title={isOnline ? 'Online' : 'Offline'} />
              {syncStatus.pendingOperations > 0 && (
                <span className="text-xs text-blue-600 font-medium">
                  {syncStatus.pendingOperations} pending
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* New Chat Button */}
        <button
          onClick={handleCreateThread}
          disabled={isCreating}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {isCreating ? "Creating..." : "New Chat"}
        </button>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-6xl mb-4">💬</div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No conversations yet</h4>
            <p className="text-gray-600 text-sm mb-4">Start your first chat to begin!</p>
            <div className="space-y-2 text-xs text-gray-500">
              <p>💡 Try asking about:</p>
              <div className="space-y-1">
                <p>• "Explain quantum computing"</p>
                <p>• "Write a Python function"</p>
                <p>• "/image a sunset over mountains"</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {threads.map((thread, index) => (
              <div
                key={thread._id}
                className="relative"
                style={{
                  animation: `fadeInUp 0.3s ease-out ${index * 50}ms both`
                }}
              >
                <div
                  className={`
                    w-full text-left p-3 rounded-lg transition-all duration-200 group cursor-pointer
                    border border-transparent hover:border-gray-200
                    ${state.selectedThreadId === thread._id
                      ? 'bg-blue-50 border-blue-200 shadow-sm' 
                      : 'hover:bg-gray-50'
                    }
                    ${thread.isOptimistic ? 'opacity-70' : ''}
                    ${thread.hasLocalChanges ? 'border-l-4 border-l-blue-400' : ''}
                  `}
                  onClick={() => handleSelectThread(thread._id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Thread Icon */}
                    <div className={`
                      w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium shrink-0 mt-0.5
                      ${state.selectedThreadId === thread._id
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                      }
                    `}>
                      {thread.isOptimistic ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      )}
                    </div>
                    
                    {/* Thread Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className={`
                          text-sm font-medium truncate pr-2
                          ${state.selectedThreadId === thread._id ? 'text-gray-900' : 'text-gray-900'}
                        `}>
                          {thread.title}
                        </h4>
                        
                        {/* Provider Badge */}
                        {thread.provider && (
                          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-md shrink-0">
                            {thread.provider}
                          </span>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-500 truncate mb-2">
                        {getThreadPreview(thread)}
                      </div>
                      
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">
                          {formatRelativeTime(thread.lastMessageAt)}
                        </span>
                        
                        {/* Model info if available */}
                        {thread.model && (
                          <span className="text-gray-400 truncate max-w-24">
                            {thread.model.replace(/^.*\//, '').replace(/-/g, ' ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDeleteThread(thread._id, thread.title, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all duration-200 text-gray-400 hover:text-red-600"
                      title="Delete chat"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Footer info when there are threads */}
        {threads.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-500 text-center space-y-1">
              <p>
                {threads.length} conversation{threads.length !== 1 ? 's' : ''}
                {syncStatus.lastSyncTime && (
                  <span className="block">
                    Last sync: {new Date(syncStatus.lastSyncTime).toLocaleTimeString()}
                  </span>
                )}
              </p>
              {!isOnline && (
                <p className="text-amber-600 font-medium">
                  ⚠️ Offline - changes will sync when connected
                </p>
              )}
              {syncStatus.hasError && (
                <p className="text-red-600 font-medium">
                  ❌ {syncStatus.error}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Add keyframe animation CSS (this would normally go in your CSS file)
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(style);
