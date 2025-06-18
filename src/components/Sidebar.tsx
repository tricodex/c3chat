import { useState } from "react";
import { toast } from "sonner";
import { useEnhancedSync, useThreads, useOnlineStatus, useSyncStatus } from "../lib/sync-engine-switcher";
import { Settings } from "./Settings";
import { Plus, X, Search, MessageSquare, Settings as SettingsIcon, Sun, Moon, Trash2, Clock, Zap } from "lucide-react";

export function Sidebar({ 
  isOpen, 
  onClose,
  theme,
  setTheme,
  isCollapsed = false 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  isCollapsed?: boolean;
}) {
  const { state, actions } = useEnhancedSync();
  const threads = useThreads();
  const isOnline = useOnlineStatus();
  const syncStatus = useSyncStatus();
  const [isCreating, setIsCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleCreateThread = async () => {
    if (isCreating) return;
    
    setIsCreating(true);
    try {
      const threadId = await actions.createThread();
      toast.success("New chat created!");
      if (window.innerWidth < 768) {
        onClose();
      }
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
      if (window.innerWidth < 768) {
        onClose();
      }
    } catch (error) {
      toast.error("Failed to open chat");
      console.error(error);
    }
  };

  const handleDeleteThread = async (threadId: string, threadTitle: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
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

  const filteredThreads = threads.filter(thread => 
    thread.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <aside className={`c3-sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''} c3-scrollbar`}>
        {/* Sidebar Header */}
        <div className="pl-4 pr-4 py-6 border-b border-[var(--c3-border-subtle)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-xl font-normal text-[var(--c3-text-primary)] tracking-wide flex items-center gap-2" 
                  style={{ 
                    fontFamily: 'var(--c3-font-mono)', 
                    fontWeight: '400',
                    letterSpacing: '0.1em'
                  }}>
                <img src="/logo.png" alt="C3" className="w-6 h-6 rounded" />
                CHAT
              </h1>
              <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--c3-text-tertiary)' }}>
                {threads.length} conversation{threads.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <button
              onClick={onClose}
              className="c3-button c3-button-ghost c3-button-icon md:hidden"
              aria-label="Close sidebar"
              >
              <X className="w-5 h-5" />
              </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={handleCreateThread}
            disabled={isCreating}
            className="w-full c3-button c3-button-primary"
          >
            <Plus className="w-4 h-4" />
            {isCreating ? "Creating..." : "New Chat"}
          </button>

          {/* Search Bar */}
          {threads.length > 5 && (
            <div className="mt-3 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none c3-transition-colors"
                style={{ 
                  backgroundColor: 'var(--c3-surface-primary)',
                  border: '1px solid var(--c3-border-subtle)',
                  color: 'var(--c3-text-primary)',
                  '::placeholder': { color: 'var(--c3-text-tertiary)' }
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--c3-primary)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--c3-border-subtle)'}
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4" style={{ color: 'var(--c3-text-tertiary)' }} />
            </div>
          )}
        </div>

        {/* Thread List - Compact Style */}
        <div className="c3-thread-list">
        {filteredThreads.length === 0 ? (
            <div className="text-center py-8 px-4">
              {searchQuery ? (
                <>
                  <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--c3-text-muted)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-sm" style={{ color: 'var(--c3-text-secondary)' }}>
                    No conversations found
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--c3-surface-primary)] border border-[var(--c3-border-subtle)] flex items-center justify-center">
                    <MessageSquare className="w-8 h-8 text-[var(--c3-text-secondary)]" />
                  </div>
                  <h4 className="text-lg font-medium text-[var(--c3-text-primary)] mb-2">
                    No conversations yet
                  </h4>
                  <p className="text-[var(--c3-text-secondary)] text-sm mb-4">
                    Start your first chat to begin!
                  </p>
                  <div className="space-y-1 text-xs text-[var(--c3-text-tertiary)]">
                    <p className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      Try asking about:
                    </p>
                    <div className="space-y-0.5 pl-4">
                      <p>• Explain quantum computing</p>
                      <p>• Write a Python function</p>
                      <p>• Generate code snippets</p>
                      <p>• Analyze complex topics</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredThreads.map((thread, index) => (
                <div
                  key={thread._id}
                  className={`c3-thread-item-compact ${state.selectedThreadId === thread._id ? 'active' : ''} group`}
                  onClick={() => handleSelectThread(thread._id)}
                  style={{
                    animationDelay: `${index * 20}ms`
                  }}
                >
                  <div className="c3-thread-content flex-1 min-w-0">
                    <div className="font-medium text-sm text-[var(--c3-text-primary)] truncate">
                      {thread.title}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] text-[var(--c3-text-muted)]">
                        {formatRelativeTime(thread.lastMessageAt)}
                      </span>
                      {thread.isOptimistic && (
                        <span className="text-[10px] text-[var(--c3-primary)]">
                          • Creating
                        </span>
                      )}
                      {thread.hasLocalChanges && !thread.isOptimistic && (
                        <span className="text-[10px] text-[var(--c3-warning)]">
                          • Syncing
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Delete Button - Smaller */}
                  <button
                    onClick={(e) => handleDeleteThread(thread._id, thread.title, e)}
                    className="opacity-0 group-hover:opacity-70 p-1 hover:bg-[var(--c3-surface-hover)] rounded c3-transition-all text-[var(--c3-text-tertiary)] hover:text-[var(--c3-error)]"
                    title="Delete chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto border-t border-[var(--c3-border-subtle)] p-4">
          {/* Sync Status */}
          {threads.length > 0 && (
            <div className="text-xs text-[var(--c3-text-tertiary)] text-center mb-3">
              {syncStatus.lastSyncTime && (
                <p>Last sync: {new Date(syncStatus.lastSyncTime).toLocaleTimeString()}</p>
              )}
              {!isOnline && (
                <p className="text-[var(--c3-warning)] font-medium mt-1 flex items-center justify-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Offline - changes will sync when connected
                </p>
              )}
              {syncStatus.hasError && (
                <p className="text-[var(--c3-error)] font-medium mt-1 flex items-center justify-center gap-1">
                  <X className="w-3.5 h-3.5" />
                  {syncStatus.error}
                </p>
              )}
            </div>
          )}

          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(true)}
            className="w-full c3-button c3-button-secondary"
          >
            <SettingsIcon className="w-4 h-4" />
            Settings
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full c3-button c3-button-ghost mt-2"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4" />
                Light Mode
              </>
            ) : (
              <>
                <Moon className="w-4 h-4" />
                Dark Mode
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Settings Modal */}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
