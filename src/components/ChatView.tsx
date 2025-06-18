import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useEnhancedSync, useMessages, useSelectedThread } from "../lib/corrected-sync-engine";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { EmptyState } from "./EmptyState";
import { FileUpload } from "./FileUpload";
import { ModelSelector } from "./ModelSelector";
import { TokenUsageBar } from "./TokenUsageBar";
import { AgentSelector } from "./AgentSelector";
import { Tooltip } from "./ui/Tooltip";
import { Id } from "../../convex/_generated/dataModel";
import { Brain, Zap, GitBranch, Download, ChartBar, Globe, Search, BookOpen, TrendingUp, HelpCircle, ChevronDown, Image, Video, Trash2, FileText } from "lucide-react";
import { getStoredApiKey, AI_PROVIDERS } from "../lib/ai-providers";
import { getAgentSystemPrompt, getAgentTemperature } from "../lib/ai-agents";

export function ChatView() {
  const { actions, state } = useEnhancedSync();
  const selectedThread = useSelectedThread();
  const messages = useMessages(selectedThread?._id);
  
  // Debug logging
  useEffect(() => {
    console.log('🎯 ChatView state:', {
      threadId: selectedThread?._id,
      messageCount: messages.length,
      messages: messages.map(m => ({
        id: m._id,
        role: m.role,
        content: m.content?.substring(0, 30) + '...',
        isStreaming: m.isStreaming,
        isOptimistic: m.isOptimistic
      }))
    });
  }, [messages, selectedThread]);
  
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [attachments, setAttachments] = useState<Id<"attachments">[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("assistant");
  
  // Use the actual provider and model from the selected thread instead of local state
  const selectedProvider = selectedThread?.provider || "openai";
  const selectedModel = selectedThread?.model || "gpt-4o";
  const [showCommandsDropdown, setShowCommandsDropdown] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Check if user is near bottom of scroll
  const checkIfNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    
    const threshold = 150; // pixels from bottom
    const isNear = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    setIsNearBottom(isNear);
    return isNear;
  };

  // Auto-scroll only when appropriate
  useEffect(() => {
    // Only auto-scroll if:
    // 1. User is near bottom (following conversation)
    // 2. Or it's the initial load (messages.length === 0 -> messages.length > 0)
    // 3. Or user just sent a message (shouldAutoScroll flag)
    if (isNearBottom || shouldAutoScroll || messages.length <= 1) {
      scrollToBottom();
      setShouldAutoScroll(false);
    }
  }, [messages, isNearBottom, shouldAutoScroll]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCommandsDropdown(false);
      }
    };

    if (showCommandsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showCommandsDropdown]);

  const handleSubmit = async (content: string) => {
    if (!selectedThread || !content.trim()) return;

    const apiKey = await getStoredApiKey(selectedProvider);
    if (!apiKey) {
      const provider = AI_PROVIDERS[selectedProvider];
      const providerName = provider?.name || selectedProvider;
      toast.error(
        <div>
          <div className="font-semibold">API Key Required</div>
          <div className="text-sm mt-1">Please configure your {providerName} API key in Settings (click the gear icon in the sidebar)</div>
        </div>
      );
      return;
    }

    setIsSending(true);
    setInput("");
    setShouldAutoScroll(true); // Auto-scroll when user sends a message

    try {
      // Handle commands
      if (content.startsWith("/")) {
        const [command, ...args] = content.slice(1).split(" ");
        
        switch (command.toLowerCase()) {
          case "image":
          case "img": {
            if (args.length === 0) {
              toast.error("Please provide a prompt for image generation");
              setInput(content);
              return;
            }
            const imagePrompt = args.join(" ");
            
            // Check if current provider supports image generation
            const provider = AI_PROVIDERS[selectedProvider];
            if (!provider?.supportsMediaGeneration) {
              toast.error(`${provider?.name || selectedProvider} doesn't support image generation. Use Google Gemini with Imagen models.`);
              setInput(content);
              return;
            }
            
            await actions.generateImage(imagePrompt, selectedThread._id, selectedProvider, selectedModel, apiKey);
            break;
          }
          
          case "video":
          case "vid": {
            if (args.length === 0) {
              toast.error("Please provide a prompt for video generation");
              setInput(content);
              return;
            }
            const videoPrompt = args.join(" ");
            
            // Check if current provider supports video generation
            const provider = AI_PROVIDERS[selectedProvider];
            if (!provider?.supportsMediaGeneration) {
              toast.error(`${provider?.name || selectedProvider} doesn't support video generation. Use Google Gemini with Veo models.`);
              setInput(content);
              return;
            }
            
            await actions.generateVideo(videoPrompt, selectedThread._id, selectedProvider, selectedModel, apiKey);
            break;
          }
            
          case "search": {
            if (args.length === 0) {
              toast.error("Please provide a search query");
              setInput(content);
              return;
            }
            const searchQuery = args.join(" ");
            await actions.sendMessageWithSearch(
              searchQuery, 
              selectedThread._id, 
              selectedProvider, 
              selectedModel, 
              apiKey,
              [searchQuery],
              attachments,
              selectedAgentId
            );
            break;
          }
            
          case "research": {
            if (args.length === 0) {
              toast.error("Please provide a research topic");
              setInput(content);
              return;
            }
            const researchTopic = args.join(" ");
            const researchQueries = [
              researchTopic,
              `${researchTopic} overview`,
              `${researchTopic} examples`,
              `${researchTopic} best practices`,
              `${researchTopic} latest developments`
            ];
            await actions.sendMessageWithSearch(
              researchTopic, 
              selectedThread._id, 
              selectedProvider, 
              selectedModel, 
              apiKey,
              researchQueries,
              attachments,
              selectedAgentId
            );
            break;
          }
            
          case "branch":
            if (actions.createBranch) {
              await actions.createBranch(selectedThread._id);
              toast.success("Conversation branch created");
            }
            break;
            
          case "export": {
            const format = args[0] || "markdown";
            if (actions.exportThread) {
              await actions.exportThread(selectedThread._id, format);
              toast.success(`Conversation exported as ${format}`);
            }
            break;
          }
            
          case "clear":
            await actions.clearThread(selectedThread._id);
            toast.success("Conversation cleared");
            break;
            
          case "help": {
            // Show help message with available commands
            const helpMessage = `# 🤖 C3Chat Commands\n\n` +
              `**🔍 Web Search & Research**\n` +
              `• \`/search <query>\` - Search the web for current information\n` +
              `• \`/research <topic>\` - Deep research with multiple search queries\n` +
              `• Toggle "Web Search" above to enable search for all messages\n\n` +
              `**🎨 Content Generation**\n` +
              `• \`/image <prompt>\` - Generate an image with AI (Gemini Imagen)\n` +
              `• \`/video <prompt>\` - Generate a video with AI (Gemini Veo)\n\n` +
              `**💬 Conversation Management**\n` +
              `• \`/branch\` - Create a new conversation branch\n` +
              `• \`/clear\` - Clear all messages in this thread\n` +
              `• \`/export [format]\` - Export conversation (markdown/json)\n\n` +
              `**💡 Examples:**\n` +
              `• \`/search latest AI developments 2024\`\n` +
              `• \`/research climate change solutions\`\n` +
              `• \`/image sunset over mountains\``;
            await actions.sendSystemMessage(helpMessage, selectedThread._id);
            break;
          }
            
          default:
            toast.error(`Unknown command: /${command}`);
            setInput(content);
            return;
        }
      } else {
        // Regular message - check if user is trying to search without using /search command
        const searchKeywords = ['search', 'find', 'look up', 'latest news', 'what is', 'tell me about', 'research'];
        const hasSearchIntent = searchKeywords.some(keyword => 
          content.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (hasSearchIntent) {
          // Add a helpful system message suggesting web search
          await actions.sendSystemMessage(
            `💡 **Tip**: It looks like you want to search for information! Try:\n\n` +
            `• **\`/search ${content}\`** - Search the web for this query\n` +
            `• **\`/research ${content}\`** - Deep research with multiple queries\n` +
            `• **Click "Commands" button** above to see all available commands\n\n` +
            `I'll still try to help with my existing knowledge:`,
            selectedThread._id
          );
        }
        
        await actions.sendMessage(
          content, 
          selectedThread._id, 
          selectedProvider, 
          selectedModel, 
          apiKey,
          attachments,
          selectedAgentId
        );
      }
      
      // Clear attachments after sending
      setAttachments([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
      setInput(content);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUploadComplete = (uploadedAttachments: Id<"attachments">[]) => {
    setAttachments([...attachments, ...uploadedAttachments]);
    setShowFileUpload(false);
    toast.success(`${uploadedAttachments.length} file(s) attached`);
  };

  if (!selectedThread) {
    return <EmptyState />;
  }

  return (
    <div className="c3-chat-container">
      {/* Control Bar */}
      <div className="c3-chat-controls">
        <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: 'var(--c3-border-subtle)' }}>
          <div className="flex items-center gap-3">
            {/* Agent Selector */}
            <AgentSelector
              currentAgentId={selectedAgentId}
              onSelect={setSelectedAgentId}
            />
            
            {/* Commands Help Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <Tooltip 
                content="View all available slash commands"
                position="bottom"
                delay={300}
              >
                <button
                  onClick={() => setShowCommandsDropdown(!showCommandsDropdown)}
                  className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all font-mono bg-[var(--c3-surface-primary)] text-[var(--c3-text-secondary)] border border-[var(--c3-border-subtle)] hover:bg-[var(--c3-surface-hover)]"
                  aria-label="Show commands help"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Commands</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showCommandsDropdown ? 'rotate-180' : ''}`} />
                </button>
              </Tooltip>
              
              {showCommandsDropdown && (
                <div 
                  className="absolute top-full left-0 mt-2 w-80 bg-[var(--c3-surface-primary)] border border-[var(--c3-border-subtle)] rounded-lg shadow-lg z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-3 border-b border-[var(--c3-border-subtle)]">
                    <h3 className="text-sm font-semibold text-[var(--c3-text-primary)] mb-1">💬 Available Commands</h3>
                    <p className="text-xs text-[var(--c3-text-tertiary)]">Type these commands in your message to activate special features</p>
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto">
                    {/* Search Commands */}
                    <div className="p-3 border-b border-[var(--c3-border-subtle)]">
                      <h4 className="text-xs font-medium text-[var(--c3-primary)] mb-2 flex items-center gap-1">
                        <Search className="w-3 h-3" />
                        Web Search & Research
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <code className="text-xs bg-gray-800 dark:bg-gray-200 px-1.5 py-0.5 rounded font-mono text-white dark:text-gray-900">/search</code>
                          <div>
                            <div className="text-xs text-gray-900 dark:text-gray-100">Search the web in real-time</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Example: /search latest AI developments 2024</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <code className="text-xs bg-gray-800 dark:bg-gray-200 px-1.5 py-0.5 rounded font-mono text-white dark:text-gray-900">/research</code>
                          <div>
                            <div className="text-xs text-black dark:text-gray-100">Deep research with multiple queries</div>
                            <div className="text-xs text-black dark:text-gray-400">Example: /research climate change solutions</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Content Generation - Only show if provider supports it */}
                    {AI_PROVIDERS[selectedProvider]?.supportsMediaGeneration && (
                      <div className="p-3 border-b border-[var(--c3-border-subtle)]">
                        <h4 className="text-xs text-grey-500 font-medium mb-2 flex items-center gap-1">
                          <Image className="w-3 h-3" />
                          Content Generation
                        </h4>
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <code className="text-xs bg-gray-800 dark:bg-gray-200 px-1.5 py-0.5 rounded font-mono text-white dark:text-gray-900">/image</code>
                            <div>
                              <div className="text-xs text-gray-900 dark:text-gray-100">Generate AI images (Imagen)</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">Example: /image sunset over mountains</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <code className="text-xs bg-gray-800 dark:bg-gray-200 px-1.5 py-0.5 rounded font-mono text-white dark:text-gray-900">/video</code>
                            <div>
                              <div className="text-xs text-gray-900 dark:text-gray-100">Generate AI videos (Veo)</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">Example: /video waves crashing on beach</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Conversation Management */}
                    <div className="p-3">
                      <h4 className="text-xs font-medium mb-2 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        Conversation Tools
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <code className="text-xs bg-gray-800 dark:bg-gray-200 px-1.5 py-0.5 rounded font-mono text-white dark:text-gray-900">/clear</code>
                          <div className="text-xs text-black dark:text-gray-100">Clear all messages</div>
                        </div>
                        <div className="flex items-start gap-2">
                          <code className="text-xs bg-gray-800 dark:bg-gray-200 px-1.5 py-0.5 rounded font-mono text-white dark:text-gray-900">/branch</code>
                          <div className="text-xs text-black dark:text-gray-100">Create conversation branch</div>
                        </div>
                        <div className="flex items-start gap-2">
                          <code className="text-xs bg-gray-800 dark:bg-gray-200 px-1.5 py-0.5 rounded font-mono text-white dark:text-gray-900">/export</code>
                          <div className="text-xs text-black dark:text-gray-100">Export conversation</div>
                        </div>
                        <div className="flex items-start gap-2">
                          <code className="text-xs bg-gray-800 dark:bg-gray-200 px-1.5 py-0.5 rounded font-mono text-white dark:text-gray-900">/help</code>
                          <div className="text-xs text-black dark:text-gray-100">Show detailed help</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Thread Actions and Analytics */}
          <div className="flex items-center gap-3">
            {/* Token Analytics Display */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--c3-surface-primary)] rounded-lg border border-[var(--c3-border-subtle)]">
              <TrendingUp className="w-4 h-4 text-[var(--c3-primary)]" />
              <span className="text-sm font-mono text-[var(--c3-text-secondary)]">
                Tokens: 1.2K
              </span>
            </div>
            
            {/* Action Buttons with Text */}
            <div className="flex items-center gap-2">
              <Tooltip content="Create a conversation branch from this point" position="bottom">
                <button
                  onClick={() => actions.createBranch && actions.createBranch(selectedThread._id)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--c3-surface-primary)] hover:bg-[var(--c3-surface-hover)] transition-colors flex items-center gap-2 text-sm font-mono border border-[var(--c3-border-subtle)]"
                  aria-label="Create conversation branch"
                >
                  <GitBranch className="w-4 h-4 text-[var(--c3-text-tertiary)]" />
                  <span className="text-[var(--c3-text-secondary)]">Branch</span>
                </button>
              </Tooltip>
              
              <Tooltip content="Export conversation as Markdown" position="bottom">
                <button
                  onClick={() => actions.exportThread && actions.exportThread(selectedThread._id, "markdown")}
                  className="px-3 py-1.5 rounded-lg bg-[var(--c3-surface-primary)] hover:bg-[var(--c3-surface-hover)] transition-colors flex items-center gap-2 text-sm font-mono border border-[var(--c3-border-subtle)]"
                  aria-label="Export conversation"
                >
                  <Download className="w-4 h-4 text-[var(--c3-text-tertiary)]" />
                  <span className="text-[var(--c3-text-secondary)]">Export</span>
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
        
        {/* Token Usage Bar */}
        <TokenUsageBar threadId={selectedThread._id} />
      </div>
      
      {/* Messages */}
      <MessageList 
        messages={messages} 
        messagesEndRef={messagesEndRef}
        threadId={selectedThread._id}
        containerRef={messagesContainerRef}
        onScroll={checkIfNearBottom}
      />

      {/* Input */}
      <MessageInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        onFileClick={() => setShowFileUpload(true)}
        isLoading={isSending}
        isOnline={state.isOnline}
        attachments={attachments}
        onRemoveAttachment={(index) => {
          setAttachments(attachments.filter((_, i) => i !== index));
        }}
      />

      {/* File Upload Modal */}
      {showFileUpload && (
        <FileUpload
          onUploadComplete={handleFileUploadComplete}
          onCancel={() => setShowFileUpload(false)}
        />
      )}
    </div>
  );
}
