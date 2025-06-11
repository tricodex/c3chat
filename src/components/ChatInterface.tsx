import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { ModelSelector } from "./ModelSelector";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { useEnhancedSync, useMessages, useSelectedThread } from "../lib/corrected-sync-engine";

export function ChatInterface() {
  const { state, actions } = useEnhancedSync();
  const selectedThread = useSelectedThread();
  const messages = useMessages();
  
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleModelChange = async (provider: string, model: string) => {
    if (!selectedThread) return;
    
    try {
      await actions.updateThread(selectedThread._id, { provider, model });
      toast.success("Model updated");
    } catch (error) {
      toast.error("Failed to update model");
      console.error(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending || !selectedThread) return;

    const messageContent = input.trim();
    setInput("");
    setIsSending(true);

    try {
      // Check if this is an image generation request
      const isImageRequest = messageContent.toLowerCase().startsWith("/image ");
      
      if (isImageRequest) {
        const prompt = messageContent.slice(7).trim();
        if (!prompt) {
          toast.error("Please provide a prompt for image generation");
          setInput(messageContent); // Restore input
          return;
        }
        
        // For now, just send as regular message with image prefix
        // The backend will handle image generation
        await actions.sendMessage(messageContent, selectedThread._id);
      } else {
        // Send regular message with optimistic updates
        await actions.sendMessage(messageContent, selectedThread._id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
      setInput(messageContent); // Restore input on error
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Allow Shift+Enter for new line
        return;
      } else {
        // Send message on Enter
        e.preventDefault();
        handleSubmit(e);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // TODO: Implement file upload functionality
    toast.info("File upload coming soon!");
  };

  const handleMessageUpdate = async (messageId: string, updates: any) => {
    try {
      await actions.updateMessage(messageId, updates);
    } catch (error) {
      console.error("Failed to update message:", error);
    }
  };

  if (!selectedThread) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">🤖</div>
          <h2 className="text-2xl font-semibold text-gray-600 mb-2">
            No chat selected
          </h2>
          <p className="text-gray-500">
            Choose a conversation from the sidebar or create a new one
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg text-gray-900">{selectedThread.title}</h2>
              {selectedThread.isOptimistic && (
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent" />
                  Creating chat...
                </p>
              )}
              {selectedThread.hasLocalChanges && (
                <p className="text-sm text-blue-600">💾 Syncing changes...</p>
              )}
            </div>
            {state.isOnline ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                Online
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                Offline
              </div>
            )}
          </div>
        </div>
        <ModelSelector
          currentProvider={selectedThread.provider || "openai"}
          currentModel={selectedThread.model || "gpt-4o-mini"}
          onSelect={handleModelChange}
          compact={true}
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-6xl mb-4">💬</div>
            <p className="text-lg font-medium mb-2">Start a conversation</p>
            <p className="text-sm mb-4">Send a message below or try:</p>
            <div className="mt-4 space-y-2">
              <p className="text-sm italic text-gray-400">"/image a futuristic city at sunset"</p>
              <p className="text-sm italic text-gray-400">"Explain quantum computing in simple terms"</p>
              <p className="text-sm italic text-gray-400">"Write a Python function to sort a list"</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message._id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              } ${message.isOptimistic ? 'opacity-70' : ''}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 relative ${
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
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-white">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            title="Attach file"
            disabled={isSending}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (or '/image' for image generation)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white resize-none min-h-[44px] max-h-32"
            disabled={isSending}
            rows={1}
            style={{
              minHeight: '44px',
              height: `${Math.min(Math.max(44, input.split('\n').length * 20 + 24), 128)}px`
            }}
          />
          
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Sending...
              </div>
            ) : (
              "Send"
            )}
          </button>
        </form>
        
        <div className="mt-2 text-xs text-gray-500 text-center">
          Press Enter to send • Shift+Enter for new line
          {!state.isOnline && (
            <span className="block mt-1 text-amber-600 font-medium">
              ⚠️ You're offline - messages will be sent when reconnected
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
