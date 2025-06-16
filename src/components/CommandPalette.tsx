import { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { useEnhancedSync, useThreads } from '../lib/corrected-sync-engine.tsx';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { 
  Search, Plus, MessageSquare, Settings, Moon, Sun, 
  GitBranch, Share2, Download, Trash2, Archive,
  Hash, User, Bot, Globe, Key, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface CommandPaletteProps {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

export function CommandPalette({ theme, setTheme }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { state, actions } = useEnhancedSync();
  const threads = useThreads();
  
  const shareThread = useMutation(api.threads.share);
  const archiveThread = useMutation(api.threads.archive);
  const deleteThread = useMutation(api.threads.remove);

  // Open command palette with Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleNewChat = async () => {
    try {
      await actions.createThread();
      setOpen(false);
      toast.success('New chat created');
    } catch (error) {
      toast.error('Failed to create new chat');
    }
  };

  const handleSelectThread = (threadId: string) => {
    actions.selectThread(threadId);
    setOpen(false);
  };

  const handleShare = async () => {
    if (!state.selectedThreadId) {
      toast.error('No chat selected');
      return;
    }

    try {
      const shareId = await shareThread({ threadId: state.selectedThreadId as any });
      const shareUrl = `${window.location.origin}/share/${shareId}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied to clipboard');
      setOpen(false);
    } catch (error) {
      toast.error('Failed to share chat');
    }
  };

  const handleArchive = async () => {
    if (!state.selectedThreadId) {
      toast.error('No chat selected');
      return;
    }

    try {
      await archiveThread({ 
        threadId: state.selectedThreadId as any, 
        archived: true 
      });
      toast.success('Chat archived');
      setOpen(false);
    } catch (error) {
      toast.error('Failed to archive chat');
    }
  };

  const handleDelete = async () => {
    if (!state.selectedThreadId) {
      toast.error('No chat selected');
      return;
    }

    if (!confirm('Are you sure you want to delete this chat? This cannot be undone.')) {
      return;
    }

    try {
      await deleteThread({ threadId: state.selectedThreadId as any });
      await actions.selectThread(null);
      toast.success('Chat deleted');
      setOpen(false);
    } catch (error) {
      toast.error('Failed to delete chat');
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
    setOpen(false);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command Menu"
      className="fixed inset-0 z-50"
    >
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={() => setOpen(false)}
      />
      <div className="fixed inset-x-0 top-[20vh] mx-auto max-w-2xl">
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command or search..."
            className="w-full px-4 py-3 text-lg border-b border-gray-200 focus:outline-none"
          />
          
          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-gray-500">
              No results found.
            </Command.Empty>

            {/* Quick Actions */}
            <Command.Group heading="Quick Actions" className="px-2 py-1.5 text-xs font-semibold text-gray-500">
              <Command.Item
                onSelect={handleNewChat}
                className="flex items-center gap-3 px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-gray-100"
              >
                <Plus className="w-4 h-4" />
                <span>New Chat</span>
              </Command.Item>

              <Command.Item
                onSelect={handleShare}
                className="flex items-center gap-3 px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-gray-100"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Current Chat</span>
              </Command.Item>

              <Command.Item
                onSelect={() => {
                  actions.exportThread?.(state.selectedThreadId as any, 'markdown');
                  setOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-gray-100"
              >
                <Download className="w-4 h-4" />
                <span>Export Chat</span>
              </Command.Item>

              <Command.Item
                onSelect={handleArchive}
                className="flex items-center gap-3 px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-gray-100"
              >
                <Archive className="w-4 h-4" />
                <span>Archive Chat</span>
              </Command.Item>

              <Command.Item
                onSelect={handleDelete}
                className="flex items-center gap-3 px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-gray-100 text-red-600"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Chat</span>
              </Command.Item>
            </Command.Group>

            {/* Recent Chats */}
            {threads.length > 0 && (
              <Command.Group heading="Recent Chats" className="px-2 py-1.5 text-xs font-semibold text-gray-500">
                {threads.slice(0, 5).map((thread) => (
                  <Command.Item
                    key={thread._id}
                    value={thread.title}
                    onSelect={() => handleSelectThread(thread._id)}
                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-gray-100"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span className="flex-1 truncate">{thread.title}</span>
                    {thread._id === state.selectedThreadId && (
                      <span className="text-xs text-blue-600">Current</span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Settings */}
            <Command.Group heading="Settings" className="px-2 py-1.5 text-xs font-semibold text-gray-500">
              <Command.Item
                onSelect={toggleTheme}
                className="flex items-center gap-3 px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-gray-100"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span>Toggle Theme</span>
              </Command.Item>

              <Command.Item
                onSelect={() => {
                  window.open('https://github.com/yourusername/c3chat', '_blank');
                  setOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-gray-100"
              >
                <HelpCircle className="w-4 h-4" />
                <span>Help & Documentation</span>
              </Command.Item>
            </Command.Group>

            {/* AI Models */}
            <Command.Group heading="AI Models" className="px-2 py-1.5 text-xs font-semibold text-gray-500">
              <Command.Item
                onSelect={() => {
                  // Switch to GPT-4
                  setOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-gray-100"
              >
                <Bot className="w-4 h-4" />
                <span>GPT-4o</span>
              </Command.Item>

              <Command.Item
                onSelect={() => {
                  // Switch to Claude
                  setOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-gray-100"
              >
                <User className="w-4 h-4" />
                <span>Claude 3 Opus</span>
              </Command.Item>

              <Command.Item
                onSelect={() => {
                  // Switch to Gemini
                  setOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-gray-100"
              >
                <Globe className="w-4 h-4" />
                <span>Gemini 1.5 Pro</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </div>
      </div>
    </Command.Dialog>
  );
}