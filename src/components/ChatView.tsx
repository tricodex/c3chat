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
import { Brain, Zap, GitBranch, Download, ChartBar, Globe, Search, BookOpen, TrendingUp } from "lucide-react";
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
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [isDeepResearchMode, setIsDeepResearchMode] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (content: string) => {
    if (!selectedThread || !content.trim()) return;

    const apiKey = getStoredApiKey(selectedProvider);
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
            await actions.generateImage(imagePrompt, selectedThread._id);
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
              `• \`/image <prompt>\` - Generate an image with AI\n\n` +
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
        // Regular message with optional web search
        if (enableWebSearch || isDeepResearchMode) {
          // Extract potential search queries from the message
          const searchQueries = isDeepResearchMode 
            ? [content, `${content} examples`, `${content} best practices`]
            : [content];
          
          await actions.sendMessageWithSearch(
            content, 
            selectedThread._id, 
            selectedProvider, 
            selectedModel, 
            apiKey,
            searchQueries,
            attachments,
            selectedAgentId
          );
        } else {
          // Check if user is trying to search without using /search command
          const searchKeywords = ['search', 'find', 'look up', 'latest news', 'what is', 'tell me about', 'research'];
          const hasSearchIntent = searchKeywords.some(keyword => 
            content.toLowerCase().includes(keyword.toLowerCase())
          );
          
          if (hasSearchIntent && !enableWebSearch && !isDeepResearchMode) {
            // Add a helpful system message suggesting web search
            await actions.sendSystemMessage(
              `💡 **Tip**: It looks like you want to search for information! Try:\n\n` +
              `• **\`/search ${content}\`** - Search the web for this query\n` +
              `• **\`/research ${content}\`** - Deep research with multiple queries\n` +
              `• **Enable "Web Search" toggle** above and ask your question\n\n` +
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
            
            {/* Feature Toggles */}
            <div className="flex items-center gap-2">
              <Tooltip 
                content={enableWebSearch ? "Disable web search" : "Enable real-time web search for all messages"}
                position="bottom"
                delay={300}
              >
                <button
                  onClick={() => setEnableWebSearch(!enableWebSearch)}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all font-mono ${
                    enableWebSearch 
                      ? 'bg-[var(--c3-primary)]/15 text-[var(--c3-primary)] border border-[var(--c3-primary)] shadow-sm' 
                      : 'bg-[var(--c3-surface-primary)] text-[var(--c3-text-secondary)] border border-[var(--c3-border-subtle)] hover:bg-[var(--c3-surface-hover)]'
                  }`}
                  aria-label={enableWebSearch ? "Disable web search" : "Enable web search"}
                >
                  <Globe className="w-4 h-4" />
                  <span className="hidden sm:inline">Web Search</span>
                  {enableWebSearch && <div className="w-2 h-2 bg-[var(--c3-primary)] rounded-full animate-pulse ml-1" />}
                </button>
              </Tooltip>
              
              <Tooltip 
                content={isDeepResearchMode ? "Disable deep research" : "Enable deep research mode with multiple search queries and comprehensive analysis"}
                position="bottom"
                delay={300}
              >
                <button
                  onClick={() => setIsDeepResearchMode(!isDeepResearchMode)}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all font-mono ${
                    isDeepResearchMode 
                      ? 'bg-[var(--c3-primary)]/15 text-[var(--c3-primary)] border border-[var(--c3-primary)] shadow-sm' 
                      : 'bg-[var(--c3-surface-primary)] text-[var(--c3-text-secondary)] border border-[var(--c3-border-subtle)] hover:bg-[var(--c3-surface-hover)]'
                  }`}
                  aria-label={isDeepResearchMode ? "Disable deep research" : "Enable deep research"}
                >
                  <Brain className="w-4 h-4" />
                  <span className="hidden sm:inline">Deep Research</span>
                  {isDeepResearchMode && <div className="w-2 h-2 bg-[var(--c3-primary)] rounded-full animate-pulse ml-1" />}
                </button>
              </Tooltip>
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
