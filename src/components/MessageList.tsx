import { RefObject, useState } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Message } from "../lib/corrected-sync-engine";
import { Id } from "../../convex/_generated/dataModel";
import { MessageCircle, Sparkles, Globe, Brain, Bot, User, Hash, Clock, Cpu, MessageSquare, Search, Braces } from "lucide-react";
import { MessageActions } from "./MessageActions";
import { MessageEdit } from "./MessageEdit";

interface MessageListProps {
  messages: Message[];
  messagesEndRef: RefObject<HTMLDivElement>;
  threadId: Id<"threads">;
  containerRef?: RefObject<HTMLDivElement>;
  onScroll?: () => void;
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

export function MessageList({ messages, messagesEndRef, threadId, containerRef, onScroll }: MessageListProps) {
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  
  
  if (messages.length === 0) {
    return (
      <div 
        className="c3-messages c3-scrollbar"
        ref={containerRef}
        onScroll={onScroll}
      >
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
          
          {/* Quick action suggestions - Compact */}
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

  // Check for duplicate IDs
  const messageIds = messages.map(m => m._id);
  const uniqueIds = new Set(messageIds);
  if (messageIds.length !== uniqueIds.size) {
    console.error('DUPLICATE MESSAGE IDS DETECTED!', {
      total: messageIds.length,
      unique: uniqueIds.size,
      duplicates: messageIds.filter((id, index) => messageIds.indexOf(id) !== index)
    });
  }
  
  return (
    <div 
      className="c3-messages c3-scrollbar"
      ref={containerRef}
      onScroll={onScroll}
    >
      {messages.map((message, index) => {
        
        // Get provider icon for assistant messages
        const ProviderIcon = message.role === "assistant" && message.provider 
          ? providerIcons[message.provider] || Bot 
          : null;
        
        return (
          <div
            key={`${message._id}-${index}`}
            className={`c3-message ${message.role} ${message.isOptimistic ? 'optimistic' : ''}`}
            onMouseEnter={() => setHoveredMessageId(message._id)}
            onMouseLeave={() => setHoveredMessageId(null)}
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
            {editingMessageId === message._id ? (
              <MessageEdit
                messageId={message._id}
                initialContent={message.content}
                onCancel={() => setEditingMessageId(null)}
                onSave={() => setEditingMessageId(null)}
              />
            ) : message.role === "assistant" ? (
              <>
                {message.isStreaming && (!message.content || message.content.length === 0) ? (
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
              <div className="whitespace-pre-wrap" style={{ color: 'var(--c3-msg-user-text)' }}>{message.content}</div>
            )}
            
            {/* Message Actions */}
            {hoveredMessageId === message._id && !message.isOptimistic && editingMessageId !== message._id && (
              <MessageActions 
                content={message.content} 
                messageId={message._id}
                threadId={threadId}
                role={message.role}
                onEdit={() => setEditingMessageId(message._id)}
              />
            )}
            
            {/* Metadata - Compact */}
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
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
