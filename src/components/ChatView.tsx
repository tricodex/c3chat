import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useEnhancedSync, useMessages, useSelectedThread } from "../lib/sync-engine-switcher";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { EmptyState } from "./EmptyState";
import { FileUpload } from "./FileUpload";
import { ModelSelector } from "./ModelSelector";
import { TokenUsageBar } from "./TokenUsageBar";
import { AgentSelector } from "./AgentSelector";
import { Tooltip } from "./ui/Tooltip";
import { Id } from "../../convex/_generated/dataModel";
import { Brain, Zap, GitBranch, Download, ChartBar, Globe, Search, BookOpen, TrendingUp, HelpCircle, ChevronDown, Image, Video, Trash2, FileText, X, Wallet } from "lucide-react";
import { getStoredApiKey, AI_PROVIDERS } from "../lib/ai-providers";
import { getAgentSystemPrompt, getAgentTemperature } from "../lib/ai-agents";
import { PaymentHandler } from "./PaymentHandler";

export function ChatView() {
  const { actions, state } = useEnhancedSync();
  const selectedThread = useSelectedThread();
  const messages = useMessages(selectedThread?._id);
  
  
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
  
  // Add viewport loading state
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const SCROLL_THRESHOLD = 200; // pixels from top/bottom to trigger load

  // Get viewport info from state
  const viewportInfo = useMemo(() => {
    if (!state.currentViewport || state.currentViewport.threadId !== selectedThread?._id) {
      return null;
    }
    return {
      hasMoreTop: state.currentViewport.hasMore?.top || false,
      hasMoreBottom: state.currentViewport.hasMore?.bottom || false,
      messageCount: state.currentViewport.messages.length,
    };
  }, [state.currentViewport, selectedThread?._id]);

  const scrollToBottom = () => {
    if (messagesEndRef.current && messagesContainerRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
  };

  // Throttled scroll handler to reduce excessive calls
  const scrollThrottleRef = useRef<NodeJS.Timeout>();
  
  const checkIfNearBottom = async () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    
    // Update near bottom status immediately
    const threshold = 150;
    const isNear = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    setIsNearBottom(isNear);
    
    // Throttle viewport loading checks
    if (!scrollThrottleRef.current && !isLoadingMore) {
      scrollThrottleRef.current = setTimeout(async () => {
        scrollThrottleRef.current = null;
        
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        
        // Load more at top
        if (scrollTop < SCROLL_THRESHOLD && viewportInfo?.hasMoreTop && !isLoadingMore) {
          setIsLoadingMore(true);
          const previousHeight = scrollHeight;
          
          try {
            await actions.loadMoreMessages('up');
            
            // Maintain scroll position after loading
            requestAnimationFrame(() => {
              if (container) {
                const newScrollHeight = container.scrollHeight;
                const heightDiff = newScrollHeight - previousHeight;
                container.scrollTop = scrollTop + heightDiff;
              }
            });
          } catch (error) {
            console.error('Failed to load more messages:', error);
          } finally {
            setIsLoadingMore(false);
          }
        }
        
        // Load more at bottom
        if (scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD && 
            viewportInfo?.hasMoreBottom && !isLoadingMore) {
          setIsLoadingMore(true);
          try {
            await actions.loadMoreMessages('down');
          } catch (error) {
            console.error('Failed to load more messages:', error);
          } finally {
            setIsLoadingMore(false);
          }
        }
      }, 200); // 200ms throttle
    }
    
    return isNear;
  };

  // Smart auto-scroll with debouncing
  const scrollDebounceRef = useRef<NodeJS.Timeout>();
  const previousMessageCount = useRef(messages.length);
  
  useEffect(() => {
    // Clear any pending scroll
    if (scrollDebounceRef.current) {
      clearTimeout(scrollDebounceRef.current);
    }
    
    // Determine if we should scroll
    const isInitialLoad = previousMessageCount.current === 0 && messages.length > 0;
    const isNewMessage = messages.length > previousMessageCount.current;
    const shouldScroll = isNearBottom || shouldAutoScroll || isInitialLoad;
    
    // Update previous count
    previousMessageCount.current = messages.length;
    
    if (shouldScroll && isNewMessage) {
      // Debounce scroll to prevent jittery behavior
      scrollDebounceRef.current = setTimeout(() => {
        scrollToBottom();
        setShouldAutoScroll(false);
      }, 100);
    }
    
    return () => {
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current);
      }
    };
  }, [messages.length, isNearBottom, shouldAutoScroll]);

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
            if (selectedProvider === "google") {
              // Check which Google model is selected
              if (selectedModel === "gemini-2.0-flash-preview-image-generation" || selectedModel === "imagen-3.0-generate-002") {
                // These models support image generation
                await actions.generateImage(imagePrompt, selectedThread._id, selectedProvider, selectedModel, apiKey);
                break;
              } else {
                // Other Gemini models don't support image generation
                toast.info("For image generation, select 'Gemini 2.0 Flash Image Gen' or 'Imagen 3', or switch to OpenAI.");
                setInput(content);
                return;
              }
            } else if (selectedProvider !== "openai") {
              toast.error(`${provider?.name || selectedProvider} doesn't support image generation. Use OpenAI for DALL-E.`);
              setInput(content);
              return;
            }
            
            // For OpenAI, generate the image
            if (selectedProvider === "openai") {
              await actions.generateImage(imagePrompt, selectedThread._id, selectedProvider, selectedModel, apiKey);
            }
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
          
          case "pay": {
            if (args.length < 2) {
              toast.error("Please use format: /pay [amount] [address]");
              setInput(content);
              return;
            }
            
            // Check if using Gemini models
            if (selectedProvider !== "google" || !selectedModel.includes("gemini")) {
              toast.error("Payment commands are only available with Google Gemini models");
              setInput(content);
              return;
            }
            
            const paymentPrompt = args.join(" ");
            await actions.processPayment(paymentPrompt, selectedThread._id, selectedProvider, selectedModel, apiKey);
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
              `• \`/image <prompt>\` - Generate an image (works with Imagen 3, Gemini Flash Image Gen, or OpenAI)\n` +
              `• \`/video <prompt>\` - Generate a video (select Veo 2 model first)\n\n` +
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
      {/* Payment Handler - invisible component that watches for payment messages */}
      <PaymentHandler />
      
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

                    {/* Payment - Only show if using Gemini models */}
                    {selectedProvider === "google" && selectedModel.includes("gemini") && (
                      <div className="p-3 border-b border-[var(--c3-border-subtle)]">
                        <h4 className="text-xs font-medium text-[var(--c3-primary)] mb-2 flex items-center gap-1">
                          <Wallet className="w-3 h-3" />
                          Web3 Payments (Gemini Only)
                        </h4>
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <code className="text-xs bg-gray-800 dark:bg-gray-200 px-1.5 py-0.5 rounded font-mono text-white dark:text-gray-900">/pay</code>
                            <div>
                              <div className="text-xs text-gray-900 dark:text-gray-100">Send USDC on Base Sepolia</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">Example: /pay 1.56 0xABCD...</div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--c3-surface-primary)] rounded-lg shadow-xl p-6 max-w-md w-full m-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--c3-text-primary)]">Upload Files</h3>
              <button
                onClick={() => setShowFileUpload(false)}
                className="p-1 rounded hover:bg-[var(--c3-surface-hover)] transition-colors"
              >
                <X className="w-5 h-5 text-[var(--c3-text-tertiary)]" />
              </button>
            </div>
            <FileUpload
              threadId={selectedThread._id}
              onUploadComplete={handleFileUploadComplete}
            />
          </div>
        </div>
      )}
    </div>
  );
}
