import { useRef, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MarkdownRenderer } from './MarkdownRenderer';
import { GitBranch, MoreVertical } from 'lucide-react';

interface Message {
  _id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
  cursor?: boolean;
  isOptimistic?: boolean;
  hasLocalChanges?: boolean;
  generatedImageUrl?: string;
  inputTokens?: number;
  outputTokens?: number;
  localCreatedAt?: number;
  _creationTime?: number;
}

interface VirtualMessageListProps {
  messages: Message[];
  onBranch?: (messageId: string) => void;
  showMessageActions: string | null;
  onToggleMessageActions: (messageId: string | null) => void;
}

interface BatchedMessage {
  role: 'user' | 'assistant' | 'system';
  messages: Message[];
  startIdx: number;
  endIdx: number;
}

export function VirtualMessageList({ 
  messages, 
  onBranch, 
  showMessageActions,
  onToggleMessageActions 
}: VirtualMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef(false);

  // Batch consecutive messages from the same role
  const batchedMessages = useMemo(() => {
    return messages.reduce<BatchedMessage[]>((acc, msg, idx) => {
      const lastBatch = acc[acc.length - 1];
      
      if (lastBatch && lastBatch.role === msg.role && !msg.isStreaming) {
        // Add to existing batch
        lastBatch.messages.push(msg);
        lastBatch.endIdx = idx;
      } else {
        // Create new batch
        acc.push({
          role: msg.role,
          messages: [msg],
          startIdx: idx,
          endIdx: idx
        });
      }
      
      return acc;
    }, []);
  }, [messages]);

  const virtualizer = useVirtualizer({
    count: batchedMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const batch = batchedMessages[index];
      // Estimate height based on content length and number of messages
      const baseHeight = 80;
      const contentHeight = batch.messages.reduce((sum, msg) => 
        sum + Math.min(msg.content.length * 0.3, 500), 0
      );
      return baseHeight + contentHeight;
    },
    overscan: 3,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!scrollingRef.current && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' || lastMessage.isOptimistic) {
        virtualizer.scrollToIndex(batchedMessages.length - 1, {
          align: 'end',
          behavior: 'smooth',
        });
      }
    }
  }, [messages.length, batchedMessages.length]);

  const handleScroll = () => {
    scrollingRef.current = true;
    clearTimeout((window as any).scrollTimeout);
    (window as any).scrollTimeout = setTimeout(() => {
      scrollingRef.current = false;
    }, 150);
  };

  return (
    <div 
      ref={parentRef} 
      className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50"
      onScroll={handleScroll}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const batch = batchedMessages[virtualItem.index];
          
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className="space-y-4">
                {batch.messages.map((message) => (
                  <div
                    key={message._id}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    } ${message.isOptimistic ? 'opacity-70' : ''}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 relative group ${
                        message.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-900 shadow-sm border border-gray-200"
                      }`}
                    >
                      {/* Optimistic indicator */}
                      {message.isOptimistic && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
                      )}
                      
                      {/* Local changes indicator */}
                      {message.hasLocalChanges && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full" title="Syncing..." />
                      )}
                      
                      {/* Message actions */}
                      {!message.isOptimistic && !message.isStreaming && onBranch && (
                        <div className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onToggleMessageActions(
                              showMessageActions === message._id ? null : message._id
                            )}
                            className={`p-1.5 rounded-md transition-colors ${
                              message.role === "user" 
                                ? "hover:bg-blue-700" 
                                : "hover:bg-gray-100"
                            }`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          
                          {showMessageActions === message._id && (
                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                              <button
                                onClick={() => {
                                  onBranch(message._id);
                                  onToggleMessageActions(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <GitBranch className="w-4 h-4" />
                                Branch from here
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {message.role === "assistant" ? (
                        <>
                          <MarkdownRenderer content={message.content} />
                          {message.cursor && (
                            <span className="inline-block w-2 h-5 bg-gray-400 ml-1 animate-pulse" />
                          )}
                          {message.isStreaming && !message.content && (
                            <div className="flex items-center gap-2 text-gray-500">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600" />
                              <span className="text-sm">Thinking...</span>
                            </div>
                          )}
                          {message.generatedImageUrl && (
                            <img 
                              src={message.generatedImageUrl} 
                              alt="Generated image" 
                              className="mt-2 rounded-lg max-w-full"
                            />
                          )}
                        </>
                      ) : (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      )}
                      
                      {/* Token usage */}
                      {message.outputTokens && (
                        <div className="text-xs opacity-70 mt-2">
                          {message.inputTokens} → {message.outputTokens} tokens
                        </div>
                      )}

                      {/* Message timestamp for debugging */}
                      {message.localCreatedAt && (
                        <div className="text-xs opacity-50 mt-1">
                          {new Date(message.localCreatedAt).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}