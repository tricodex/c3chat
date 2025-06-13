import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useEnhancedSync, useMessages, useSelectedThread } from "../lib/corrected-sync-engine";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { EmptyState } from "./EmptyState";
import { FileUpload } from "./FileUpload";
import { Id } from "../../convex/_generated/dataModel";

export function ChatView() {
  const { state, actions } = useEnhancedSync();
  const selectedThread = useSelectedThread();
  const messages = useMessages();
  
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [attachments, setAttachments] = useState<Id<"attachments">[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (content: string) => {
    if (!content.trim() || isSending || !selectedThread) return;

    setInput("");
    setIsSending(true);

    try {
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
            // The backend will handle image generation
            await actions.sendMessage(content, selectedThread._id);
            break;
            
          case "search":
            if (!query) {
              toast.error("Please provide a search query");
              setInput(content);
              return;
            }
            // The backend will handle web search
            await actions.sendMessage(content, selectedThread._id);
            break;
            
          case "help":
            // Show help message
            await actions.sendMessage(content, selectedThread._id);
            break;
            
          default:
            toast.error(`Unknown command: /${command}`);
            setInput(content);
            return;
        }
      } else {
        // Regular message
        await actions.sendMessage(content, selectedThread._id);
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
