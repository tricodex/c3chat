import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { ModelSelector } from "./ModelSelector";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { FileUpload } from "./FileUpload";
import { BranchDialog } from "./BranchDialog";
import { CollaborationPresence } from "./CollaborationPresence";
import { VirtualMessageList } from "./VirtualMessageList";
import { useEnhancedSync, useMessages, useSelectedThread } from "../lib/corrected-sync-engine.tsx";
import { Paperclip, GitBranch, MoreVertical } from "lucide-react";

export function ChatInterface() {
  const { state, actions } = useEnhancedSync();
  const selectedThread = useSelectedThread();
  const messages = useMessages();
  
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [branchMessageId, setBranchMessageId] = useState<string | null>(null);
  const [showMessageActions, setShowMessageActions] = useState<string | null>(null);
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
        // Send regular message with optimistic updates and attachments
        await actions.sendMessage(
          messageContent,
          selectedThread._id,
          undefined,
          undefined,
          undefined,
          attachmentIds.length > 0 ? attachmentIds : undefined
        );
        
        // Clear attachments after sending
        setAttachmentIds([]);
        setShowFileUpload(false);
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

  const handleFileUpload = (uploadedAttachmentIds: string[]) => {
    setAttachmentIds(prev => [...prev, ...uploadedAttachmentIds]);
  };
  
  const toggleFileUpload = () => {
    setShowFileUpload(!showFileUpload);
  };
  
  const handleBranch = (messageId?: string) => {
    setBranchMessageId(messageId || null);
    setShowBranchDialog(true);
  };
  
  const handleBranchCreated = (newThreadId: string) => {
    // Select the new branch
    actions.selectThread(newThreadId);
    setShowBranchDialog(false);
    setBranchMessageId(null);
    toast.success('Switched to new branch');
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
            <div className="flex-1">
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
            
            {/* Branch button */}
            <button
              onClick={() => handleBranch()}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Branch conversation"
            >
              <GitBranch className="w-5 h-5" />
            </button>
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
        
        {/* Collaboration presence */}
        {selectedThread.isPublic && (
          <CollaborationPresence threadId={selectedThread._id} />
        )}
      </div>

      {/* Messages */}
      {messages.length === 0 ? (
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
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
        </div>
      ) : (
        <VirtualMessageList
          messages={messages}
          onBranch={handleBranch}
          showMessageActions={showMessageActions}
          onToggleMessageActions={setShowMessageActions}
        />
      )}

      {/* File Upload Panel */}
      {showFileUpload && (
        <div className="p-4 border-t bg-gray-50">
          <FileUpload
            threadId={selectedThread._id}
            onUploadComplete={handleFileUpload}
          />
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t bg-white">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <button
            type="button"
            onClick={toggleFileUpload}
            className={`p-2 transition-colors ${
              showFileUpload || attachmentIds.length > 0 
                ? 'text-blue-600 hover:text-blue-700' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title="Attach file"
            disabled={isSending}
          >
            <Paperclip className="w-6 h-6" />
            {attachmentIds.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {attachmentIds.length}
              </span>
            )}
          </button>
          
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
      
      {/* Branch Dialog */}
      {showBranchDialog && selectedThread && (
        <BranchDialog
          threadId={selectedThread._id}
          messageId={branchMessageId as any}
          onClose={() => {
            setShowBranchDialog(false);
            setBranchMessageId(null);
          }}
          onBranchCreated={handleBranchCreated as any}
        />
      )}
    </div>
  );
}
