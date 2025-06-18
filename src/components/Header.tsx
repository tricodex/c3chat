import { useEnhancedSync, useSelectedThread } from "../lib/sync-engine-switcher";
import { ModelSelector } from "./ModelSelector";
import { SignOutButton } from "../SignOutButton";
import { Menu, Save, Sparkles, Cloud, CloudOff } from "lucide-react";
import { toast } from "sonner";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { state, actions } = useEnhancedSync();
  const selectedThread = useSelectedThread();

  const handleModelChange = async (provider: string, model: string) => {
    if (!selectedThread) return;
    
    try {
      await actions.updateThread(selectedThread._id, { provider, model });
      toast.success("Model updated");
    } catch (error) {
      toast.error("Failed to update model");
      console.error(error);
    }
  };

  return (
    <header className="c3-header">
      {/* Sidebar Toggle Button - Now visible on all screens */}
      <button
        onClick={onMenuClick}
        className="c3-button c3-button-ghost c3-button-icon mr-3"
        aria-label="Toggle sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Thread Info */}
      <div className="flex-1 min-w-0 px-2">
        {selectedThread ? (
          <div className="flex items-center justify-between w-full">
            <div className="min-w-0 flex items-center gap-2">
              <h1 className="text-sm font-semibold truncate max-w-[200px] md:max-w-[300px]" style={{ color: 'var(--c3-text-primary)' }}>
                {selectedThread.title}
              </h1>
              {selectedThread.isOptimistic && (
                <div className="c3-spinner w-3 h-3" />
              )}
              {selectedThread.hasLocalChanges && (
                <Save className="w-3 h-3" style={{ color: 'var(--c3-text-tertiary)' }} />
              )}
            </div>
            
            {/* Model Selector for current thread */}
            {selectedThread && !selectedThread.isOptimistic && (
              <ModelSelector
                currentProvider={selectedThread.provider}
                currentModel={selectedThread.model}
                onSelect={handleModelChange}
                compact
              />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: 'var(--c3-primary)' }} />
            <h1 className="text-sm font-semibold" style={{ color: 'var(--c3-text-primary)' }}>
              Select or create a new chat
            </h1>
          </div>
        )}
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-1">
        {state.isOnline ? (
          <Cloud className="w-3.5 h-3.5" style={{ color: 'var(--c3-success)' }} />
        ) : (
          <CloudOff className="w-3.5 h-3.5" style={{ color: 'var(--c3-error)' }} />
        )}
      </div>

      {/* User Menu */}
      <SignOutButton />
    </header>
  );
}
