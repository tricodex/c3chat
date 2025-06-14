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
import { Id } from "../../convex/_generated/dataModel";
import { Brain, Zap, GitBranch, Download, ChartBar, Globe } from "lucide-react";
import { getStoredApiKey } from "../lib/ai-providers";
import { getAgentSystemPrompt, getAgentTemperature } from "../lib/ai-agents";

export function ChatView() {
  const { state, actions } = useEnhancedSync();
  const selectedThread = useSelectedThread();
  const messages = useMessages();
  
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [attachments, setAttachments] = useState<Id<"attachments">[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [isDeepResearchMode, setIsDeepResearchMode] = useState(false);
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState("assistant");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (content: string) => {
    if (!content.trim() || isSending || !selectedThread || !selectedProvider || !selectedModel) {
      if (!selectedProvider || !selectedModel) {
        toast.error("Please select an AI model first");
        return;
      }
      return;
    }

    setInput("");
    setIsSending(true);

    try {
      // Get API key for selected provider
      const apiKey = getStoredApiKey(selectedProvider);
      
      // Check for special commands
      if (content.startsWith("/")) {
        const [command, ...args] = content.slice(1).split(" ");
        const query = args.join(" ").trim();
        
        switch (command.toLowerCase()) {
          case "image":
            if (!query) {
              toast.error("Please provide a prompt for image generation");
              setInput(content);
              return;
            }
            await actions.generateImage(query, selectedThread._id, selectedProvider, apiKey);
            break;
            
          case "search":
            if (!query) {
              toast.error("Please provide a search query");
              setInput(content);
              return;
            }
            await actions.sendMessageWithSearch(content, selectedThread._id, selectedProvider, selectedModel, apiKey, [query]);
            break;
            
          case "research":
            if (!query) {
              toast.error("Please provide a research topic");
              setInput(content);
              return;
            }
            // Enable deep research mode for this query
            setIsDeepResearchMode(true);
            await actions.sendMessageWithSearch(content, selectedThread._id, selectedProvider, selectedModel, apiKey, 
              [query, `${query} latest research`, `${query} best practices`, `${query} case studies`]);
            setIsDeepResearchMode(false);
            break;
            
          case "branch":
            // Create a branch from current conversation
            await actions.createBranch(selectedThread._id);
            toast.success("Created new conversation branch");
            break;
            
          case "export":
            // Export conversation
            await actions.exportThread(selectedThread._id, args[0] || "markdown");
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
              <button
                onClick={() => setEnableWebSearch(!enableWebSearch)}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all ${
                  enableWebSearch 
                    ? 'bg-[var(--c3-primary)]/10 text-[var(--c3-primary)] border border-[var(--c3-primary)]' 
                    : 'bg-[var(--c3-surface-primary)] text-[var(--c3-text-secondary)] border border-[var(--c3-border-subtle)]'
                }`}
                title="Enable web search for all messages"
              >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">Web Search</span>
              </button>
              
              <button
                onClick={() => setIsDeepResearchMode(!isDeepResearchMode)}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all ${
                  isDeepResearchMode 
                    ? 'bg-[var(--c3-primary)]/10 text-[var(--c3-primary)] border border-[var(--c3-primary)]' 
                    : 'bg-[var(--c3-surface-primary)] text-[var(--c3-text-secondary)] border border-[var(--c3-border-subtle)]'
                }`}
                title="Enable deep research mode for comprehensive answers"
              >
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">Deep Research</span>
              </button>
            </div>
          </div>
          
          {/* Thread Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => actions.createBranch(selectedThread._id)}
              className="p-1.5 rounded-lg bg-[var(--c3-surface-primary)] hover:bg-[var(--c3-surface-hover)] transition-colors"
              title="Create conversation branch"
            >
              <GitBranch className="w-4 h-4 text-[var(--c3-text-tertiary)]" />
            </button>
            
            <button
              onClick={() => actions.exportThread(selectedThread._id, "markdown")}
              className="p-1.5 rounded-lg bg-[var(--c3-surface-primary)] hover:bg-[var(--c3-surface-hover)] transition-colors"
              title="Export conversation"
            >
              <Download className="w-4 h-4 text-[var(--c3-text-tertiary)]" />
            </button>
            
            <button
              onClick={() => toast.info("Analytics coming soon!")}
              className="p-1.5 rounded-lg bg-[var(--c3-surface-primary)] hover:bg-[var(--c3-surface-hover)] transition-colors"
              title="View token usage"
            >
              <ChartBar className="w-4 h-4 text-[var(--c3-text-tertiary)]" />
            </button>
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
