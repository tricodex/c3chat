import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useEnhancedSync, useThreads } from "../lib/corrected-sync-engine";
import { AI_PROVIDERS } from "../lib/ai-providers";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Command {
  id: string;
  title: string;
  description?: string;
  icon: string | React.ReactNode;
  category: "chat" | "ai" | "settings" | "help" | "navigation";
  action: () => void;
  keywords?: string[];
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const { actions } = useEnhancedSync();
  const threads = useThreads();
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const commands: Command[] = [
    // Chat Commands
    {
      id: "new-chat",
      title: "New Chat",
      description: "Start a new conversation",
      icon: "💬",
      category: "chat",
      action: async () => {
        onClose();
        try {
          await actions.createThread();
          toast.success("New chat created!");
        } catch (error) {
          toast.error("Failed to create chat");
        }
      },
      keywords: ["create", "start", "conversation"],
    },
    {
      id: "clear-chat",
      title: "Clear Current Chat",
      description: "Delete all messages in current chat",
      icon: "🗑️",
      category: "chat",
      action: () => {
        onClose();
        toast.info("Clear chat coming soon!");
      },
    },
    {
      id: "export-chat",
      title: "Export Chat",
      description: "Download current conversation",
      icon: "📥",
      category: "chat",
      action: () => {
        onClose();
        toast.info("Export feature coming soon!");
      },
    },
    {
      id: "share-chat",
      title: "Share Chat",
      description: "Share this conversation with others",
      icon: "🔗",
      category: "chat",
      action: () => {
        onClose();
        toast.info("Share feature coming soon!");
      },
    },
    
    // AI Commands
    ...Object.values(AI_PROVIDERS).map(provider => ({
      id: `switch-to-${provider.id}`,
      title: `Switch to ${provider.name}`,
      description: provider.description,
      icon: provider.logo || "🤖",
      category: "ai" as const,
      action: () => {
        onClose();
        // This would be handled by ModelSelector
        toast.success(`Switched to ${provider.name}`);
      },
      keywords: ["model", "provider", provider.name.toLowerCase()],
    })),
    
    // Settings Commands
    {
      id: "toggle-theme",
      title: "Toggle Theme",
      description: "Switch between light and dark mode",
      icon: "🌓",
      category: "settings",
      action: () => {
        onClose();
        document.documentElement.setAttribute(
          'data-theme',
          document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
        );
      },
      keywords: ["dark", "light", "mode"],
    },
    {
      id: "manage-keys",
      title: "Manage API Keys",
      description: "Add or update your API keys",
      icon: "🔑",
      category: "settings",
      action: () => {
        onClose();
        // This would open settings modal
        toast.info("Opening API key settings...");
      },
    },
    {
      id: "preferences",
      title: "Preferences",
      description: "Customize your experience",
      icon: "⚙️",
      category: "settings",
      action: () => {
        onClose();
        toast.info("Opening preferences...");
      },
    },
    
    // Help Commands
    {
      id: "shortcuts",
      title: "Keyboard Shortcuts",
      description: "View all keyboard shortcuts",
      icon: "⌨️",
      category: "help",
      action: () => {
        onClose();
        toast.info("Keyboard shortcuts guide coming soon!");
      },
    },
    {
      id: "documentation",
      title: "Documentation",
      description: "Learn how to use C3Chat",
      icon: "📚",
      category: "help",
      action: () => {
        onClose();
        window.open("https://github.com/yourusername/c3chat", "_blank");
      },
    },
    
    // Navigation - Recent Threads
    ...threads.slice(0, 5).map(thread => ({
      id: `thread-${thread._id}`,
      title: thread.title,
      description: `Open conversation`,
      icon: "💭",
      category: "navigation" as const,
      action: async () => {
        onClose();
        try {
          await actions.selectThread(thread._id);
        } catch (error) {
          toast.error("Failed to open chat");
        }
      },
      keywords: ["chat", "thread", "conversation"],
    })),
  ];

  const filteredCommands = search
    ? commands.filter(cmd => {
        const searchLower = search.toLowerCase();
        return (
          cmd.title.toLowerCase().includes(searchLower) ||
          cmd.description?.toLowerCase().includes(searchLower) ||
          cmd.keywords?.some(k => k.includes(searchLower)) ||
          cmd.category.includes(searchLower)
        );
      })
    : activeCategory
      ? commands.filter(cmd => cmd.category === activeCategory)
      : commands;

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  const categoryLabels = {
    chat: "Chat",
    ai: "AI Models",
    settings: "Settings",
    help: "Help",
    navigation: "Recent Chats",
  };

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSearch("");
      setSelectedIndex(0);
      setActiveCategory(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
        case "Escape":
          e.preventDefault();
          if (search) {
            setSearch("");
          } else if (activeCategory) {
            setActiveCategory(null);
          } else {
            onClose();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, search, activeCategory, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Command Palette */}
      <div className="relative min-h-screen flex items-start justify-center p-4 pt-[10vh]">
        <div className="relative w-full max-w-2xl c3-glass-heavy rounded-2xl shadow-2xl overflow-hidden c3-animate-slide-up">
          {/* Header */}
          <div className="border-b border-[var(--c3-border-subtle)]">
            <div className="flex items-center px-6 py-4">
              <svg className="w-5 h-5 text-[var(--c3-text-tertiary)] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent border-none outline-none text-lg text-[var(--c3-text-primary)] placeholder-[var(--c3-text-tertiary)]"
              />
              <kbd className="c3-kbd">ESC</kbd>
            </div>
            
            {/* Category Pills */}
            {!search && (
              <div className="px-6 pb-3 flex gap-2 flex-wrap">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeCategory === null
                      ? 'bg-[var(--c3-primary)] text-white'
                      : 'bg-[var(--c3-surface-hover)] text-[var(--c3-text-secondary)] hover:text-[var(--c3-text-primary)]'
                  }`}
                >
                  All
                </button>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      activeCategory === key
                        ? 'bg-[var(--c3-primary)] text-white'
                        : 'bg-[var(--c3-surface-hover)] text-[var(--c3-text-secondary)] hover:text-[var(--c3-text-primary)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Commands List */}
          <div className="max-h-[60vh] overflow-y-auto c3-scrollbar">
            {filteredCommands.length === 0 ? (
              <div className="p-8 text-center text-[var(--c3-text-tertiary)]">
                <p className="text-lg mb-2">No commands found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            ) : (
              <div className="py-2">
                {Object.entries(groupedCommands).map(([category, cmds]) => (
                  <div key={category}>
                    <div className="px-6 py-2 text-xs font-semibold text-[var(--c3-text-tertiary)] uppercase tracking-wider">
                      {categoryLabels[category as keyof typeof categoryLabels]}
                    </div>
                    {cmds.map((cmd, idx) => {
                      const globalIndex = filteredCommands.indexOf(cmd);
                      const isSelected = globalIndex === selectedIndex;
                      
                      return (
                        <button
                          key={cmd.id}
                          onClick={cmd.action}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={`w-full px-6 py-3 flex items-center gap-3 transition-all ${
                            isSelected
                              ? 'bg-[var(--c3-surface-hover)] text-[var(--c3-text-primary)]'
                              : 'hover:bg-[var(--c3-surface-hover)] text-[var(--c3-text-secondary)]'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-[var(--c3-bg-tertiary)] flex items-center justify-center text-lg">
                            {typeof cmd.icon === 'string' ? cmd.icon : cmd.icon}
                          </div>
                          <div className="flex-1 text-left">
                            <div className="font-medium">{cmd.title}</div>
                            {cmd.description && (
                              <div className="text-xs text-[var(--c3-text-tertiary)]">
                                {cmd.description}
                              </div>
                            )}
                          </div>
                          {isSelected && (
                            <kbd className="c3-kbd">↵</kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="border-t border-[var(--c3-border-subtle)] px-6 py-3 flex items-center justify-between text-xs text-[var(--c3-text-tertiary)]">
            <div className="flex gap-4">
              <span className="flex items-center gap-1">
                <kbd className="c3-kbd">↑↓</kbd> Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="c3-kbd">↵</kbd> Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="c3-kbd">ESC</kbd> Close
              </span>
            </div>
            <div>
              {filteredCommands.length} commands
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
