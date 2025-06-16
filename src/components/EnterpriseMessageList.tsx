import { RefObject, useState } from "react";
import { toast } from "sonner";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Message, useEnterpriseSync } from "../lib/enterprise-sync-engine";
import { Id } from "../../convex/_generated/dataModel";
import { 
  MessageCircle, Sparkles, Globe, Brain, Bot, User, Hash, Clock, 
  Cpu, MessageSquare, Search, Braces, Copy, GitBranch, Edit2, 
  RefreshCw, MoreVertical, Check, ChevronRight, AlertCircle
} from "lucide-react";
import { Tooltip } from "./ui/Tooltip";

interface EnterpriseMessageListProps {
  messages: Message[];
  messagesEndRef: RefObject<HTMLDivElement>;
  threadId: Id<"threads">;
}

// Provider icon mapping using Lucide icons
const providerIcons: Record<string, React.ComponentType<any>> = {
  openai: Bot,
  anthropic: MessageSquare,
  google: Search,
  perplexity: Search,
  cohere: Braces,
  mistral: Cpu,
  baidu: Globe,
  deepseek: Brain,
  groq: Cpu,
  together: Braces,
  openrouter: Globe,
};

export function EnterpriseMessageList({ messages, messagesEndRef, threadId }: EnterpriseMessageListProps) {
  const { actions, state } = useEnterpriseSync();
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const handleCopyMessage = async (message: Message) => {
    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(message.content);
      
      // Also store in state for potential paste operations
      actions.copyMessage(message);
      
      // Visual feedback
      setCopiedMessageId(message._id);
      setTimeout(() => setCopiedMessageId(null), 2000);
      
      toast.success("Message copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy message");
    }
  };

  const handleBranchMessage = async (message: Message) => {
    try {
      const branchId = await actions.branchMessage(message._id, threadId);
      toast.success("Created new branch from this message");
      
      // Optionally navigate to the new branch
      await actions.selectThread(branchId);
    } catch (error) {
      toast.error("Failed to create branch");
    }
  };

  const handleEditMessage = (message: Message) => {
    setEditingMessageId(message._id);
    setEditContent(message.content);
  };

  const handleSaveEdit = async (messageId: string) => {
    try {
      await actions.editMessage(messageId, editContent, threadId);
      setEditingMessageId(null);
      toast.success("Message updated");
    } catch (error) {
      toast.error("Failed to update message");
    }
  };

  const handleRegenerateMessage = async (message: Message) => {
    try {
      await actions.regenerateMessage(message._id, threadId);
      toast.success("Regenerating response...");
    } catch (error) {
      toast.error("Failed to regenerate message");
    }
  };

  const toggleBranches = (messageId: string) => {
    const newExpanded = new Set(expandedBranches);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedBranches(newExpanded);
  };

  if (messages.length === 0) {
    return (
      <div className="c3-messages c3-scrollbar">
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="c3-empty-icon">
            <MessageCircle className="w-10 h-10" style={{ color: 'var(--c3-text-muted)' }} />
          </div>
          <h3 className="text-base font-medium mt-3" style={{ color: 'var(--c3-text-secondary)' }}>
            Start a new conversation
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--c3-text-tertiary)' }}>
            Ask me anything or try one of these suggestions
          </p>
          
          {/* Quick action suggestions */}
          <div className="mt-6 grid gap-2 max-w-md">
            <button className="c3-suggestion-card">
              <Sparkles className="w-4 h-4" style={{ color: 'var(--c3-primary)' }} />
              <span className="c3-suggestion-text">Generate creative content</span>
            </button>
            <button className="c3-suggestion-card">
              <Globe className="w-4 h-4" style={{ color: 'var(--c3-primary)' }} />
              <span className="c3-suggestion-text">Search real-time information</span>
            </button>
            <button className="c3-suggestion-card">
              <Brain className="w-4 h-4" style={{ color: 'var(--c3-primary)' }} />
              <span className="c3-suggestion-text">Analyze complex topics</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="c3-messages c3-scrollbar">
      {messages.map((message, index) => {
        const ProviderIcon = message.role === "assistant" && message.provider 
          ? providerIcons[message.provider] || Bot 
          : null;
        
        const isEditing = editingMessageId === message._id;
        const isCopied = copiedMessageId === message._id;
        const hasBranches = message.branches && message.branches.length > 0;
        const isExpanded = expandedBranches.has(message._id);
        
        return (
          <div key={message._id}>
            <div
              className={`c3-message ${message.role} ${message.isOptimistic ? 'optimistic' : ''} ${selectedMessageId === message._id ? 'selected' : ''}`}
              onMouseEnter={() => setSelectedMessageId(message._id)}
              onMouseLeave={() => setSelectedMessageId(null)}
            >
              {/* Avatar */}
              <div className="c3-message-avatar">
                {message.role === "user" ? (
                  <User className="w-4 h-4" />
                ) : (
                  ProviderIcon ? <ProviderIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />
                )}
              </div>

              {/* Message Content */}
              <div className="c3-message-content">
                {/* Status Indicators */}
                {message.isOptimistic && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--c3-primary)] rounded-full animate-pulse" title="Sending..." />
                )}
                {message.hasLocalChanges && !message.isOptimistic && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--c3-warning)] rounded-full" title="Syncing..." />
                )}

                {/* Content */}
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="c3-textarea"
                      rows={4}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(message._id)}
                        className="c3-button c3-button-primary c3-button-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingMessageId(null)}
                        className="c3-button c3-button-secondary c3-button-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {message.role === "assistant" ? (
                      <>
                        {message.isStreaming && !message.content ? (
                          <div className="c3-typing-indicator">
                            <div className="c3-typing-dot" />
                            <div className="c3-typing-dot" />
                            <div className="c3-typing-dot" />
                          </div>
                        ) : (
                          <>
                            <MarkdownRenderer content={message.content} />
                            {message.cursor && (
                              <span className="c3-cursor" />
                            )}
                          </>
                        )}
                        
                        {/* Generated Image */}
                        {message.generatedImageUrl && (
                          <div className="mt-3">
                            <img 
                              src={message.generatedImageUrl} 
                              alt="Generated" 
                              className="rounded-lg max-w-full shadow-lg"
                              loading="lazy"
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="whitespace-pre-wrap" style={{ color: 'var(--c3-msg-user-text)' }}>
                        {message.content}
                      </div>
                    )}
                  </>
                )}
                
                {/* Enterprise Action Bar */}
                {(selectedMessageId === message._id || isEditing) && !message.isOptimistic && (
                  <div className="flex items-center gap-1 mt-2">
                    <Tooltip content="Copy message" position="top">
                      <button
                        onClick={() => handleCopyMessage(message)}
                        className="c3-message-action"
                        aria-label="Copy message"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </Tooltip>
                    
                    {message.role === "user" && (
                      <Tooltip content="Edit message" position="top">
                        <button
                          onClick={() => handleEditMessage(message)}
                          className="c3-message-action"
                          aria-label="Edit message"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    )}
                    
                    <Tooltip content="Branch from here" position="top">
                      <button
                        onClick={() => handleBranchMessage(message)}
                        className="c3-message-action"
                        aria-label="Branch conversation"
                      >
                        <GitBranch className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                    
                    {message.role === "assistant" && (
                      <Tooltip content="Regenerate response" position="top">
                        <button
                          onClick={() => handleRegenerateMessage(message)}
                          className="c3-message-action"
                          aria-label="Regenerate response"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                )}
                
                {/* Branch Indicator */}
                {hasBranches && (
                  <button
                    onClick={() => toggleBranches(message._id)}
                    className="flex items-center gap-1 mt-2 text-xs text-[var(--c3-primary)] hover:underline"
                  >
                    <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    {message.branches!.length} branch{message.branches!.length !== 1 ? 'es' : ''}
                  </button>
                )}
                
                {/* Edit History Indicator */}
                {message.isEdited && (
                  <div className="flex items-center gap-1 text-[10px] mt-1" style={{ color: 'var(--c3-text-muted)' }}>
                    <AlertCircle className="w-3 h-3" />
                    <span>Edited</span>
                  </div>
                )}
                
                {/* Metadata */}
                {(message.outputTokens || message.createdAt) && (
                  <div className="flex items-center gap-3 text-[10px] mt-2" style={{ color: 'var(--c3-text-muted)' }}>
                    {message.outputTokens && (
                      <span className="flex items-center gap-1">
                        <Hash className="w-2.5 h-2.5" />
                        {message.outputTokens}
                      </span>
                    )}
                    {message.createdAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Branch Messages */}
            {hasBranches && isExpanded && (
              <div className="ml-12 pl-4 border-l-2 border-[var(--c3-border-subtle)] mt-2">
                {/* This would render branch messages recursively */}
                <p className="text-xs text-[var(--c3-text-tertiary)] py-2">
                  Branch messages would appear here
                </p>
              </div>
            )}
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}