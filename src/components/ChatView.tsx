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
import { getStoredApiKey } from "../lib/ai-providers";
import { getAgentSystemPrompt, getAgentTemperature } from "../lib/ai-agents";

export function ChatView() {
  const { actions, state } = useEnhancedSync();
  const selectedThread = useSelectedThread();
  const messages = useMessages(selectedThread?._id);
  
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [attachments, setAttachments] = useState<Id<"attachments">[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("assistant");
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
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
      toast.error(`Please configure your ${selectedProvider} API key in Settings`);
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
          case "img":
            if (args.length === 0) {
              toast.error("Please provide a prompt for image generation");
              setInput(content);
              return;
            }
            const imagePrompt = args.join(" ");
            await actions.generateImage(imagePrompt, selectedThread._id);
            break;
            
          case "search":
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
            
          case "research":
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
            
          case "branch":
            if (actions.createBranch) {
              await actions.createBranch(selectedThread._id);
              toast.success("Conversation branch created");
            }
            break;
            
          case "export":
            const format = args[0] || "markdown";
            if (actions.exportThread) {
              await actions.exportThread(selectedThread._id, format);
              toast.success(`Conversation exported as ${format}`);
            }
            break;
            
          case "clear":
            await actions.clearThread(selectedThread._id);
            toast.success("Conversation cleared");
            break;
            
          case "help":
            // Show help message with available commands
            const helpMessage = `Available commands:\n/image <prompt> - Generate an image\n/search <query> - Search the web\n/research <topic> - Deep research mode\n/branch - Create conversation branch\n/export [format] - Export conversation\n/clear - Clear conversation`;
            await actions.sendSystemMessage(helpMessage, selectedThread._id);
            break;
            
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
            
            {/* Model Selector */}
            <ModelSelector
              currentProvider={selectedProvider}
              currentModel={selectedModel}
              onSelect={(provider, model) => {
                setSelectedProvider(provider);
                setSelectedModel(model);
              }}
              compact
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
