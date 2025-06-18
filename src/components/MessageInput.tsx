import { useState, useRef, KeyboardEvent } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Paperclip, Send, Sparkles, Globe, Command, X, Mic, Image, FileText, File } from "lucide-react";
import { VoiceControls } from "./VoiceControls";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (content: string) => void;
  onFileClick: () => void;
  isLoading: boolean;
  isOnline: boolean;
  attachments: Id<"attachments">[];
  onRemoveAttachment: (index: number) => void;
}

export function MessageInput({
  value,
  onChange,
  onSubmit,
  onFileClick,
  isLoading,
  isOnline,
  attachments,
  onRemoveAttachment,
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showCommands, setShowCommands] = useState(false);
  
  // Fetch attachment details
  const attachmentDetails = useQuery(api.attachments.getByIds, 
    attachments.length > 0 ? { ids: attachments } : "skip"
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    
    // Show commands menu when typing "/"
    if (e.key === "/" && value === "") {
      setShowCommands(true);
    } else if (showCommands && e.key === "Escape") {
      setShowCommands(false);
    }
  };

  const handleSubmit = () => {
    if (!value.trim() || isLoading) return;
    onSubmit(value);
    setShowCommands(false);
  };

  const insertCommand = (command: string) => {
    onChange(command);
    setShowCommands(false);
    textareaRef.current?.focus();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const commandSuggestions = [
    { command: "/image", description: "Generate an image with AI", icon: Image },
    { command: "/search", description: "Search the web in real-time", icon: Globe },
    { command: "/help", description: "Show all available commands", icon: Command },
    { command: "/clear", description: "Clear the current conversation", icon: Sparkles },
  ];

  const filteredCommands = showCommands && value.startsWith("/") 
    ? commandSuggestions.filter(cmd => cmd.command.startsWith(value))
    : [];

  return (
    <div className="c3-input-area">
      {/* Attachments Preview */}
      {attachmentDetails && attachmentDetails.length > 0 && (
        <div className="px-4 py-3 border-b border-[var(--c3-border-subtle)]">
          <div className="flex flex-wrap gap-2">
            {attachmentDetails.map((attachment, index) => {
              if (!attachment) return null;
              
              const getFileIcon = () => {
                if (attachment.contentType.startsWith("image/")) return Image;
                if (attachment.contentType === "application/pdf") return FileText;
                return File;
              };
              
              const FileIcon = getFileIcon();
              const isImage = attachment.contentType.startsWith("image/");
              
              return (
                <div
                  key={attachment._id}
                  className="relative group"
                >
                  {isImage && attachment.url ? (
                    <div className="relative">
                      <img
                        src={attachment.url}
                        alt={attachment.filename}
                        className="h-16 w-16 object-cover rounded-lg border border-[var(--c3-border-subtle)]"
                      />
                      <button
                        onClick={() => onRemoveAttachment(index)}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                        type="button"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--c3-surface-secondary)] rounded-lg border border-[var(--c3-border-subtle)]">
                      <FileIcon className="w-4 h-4 text-[var(--c3-text-tertiary)]" />
                      <div className="max-w-[150px]">
                        <p className="text-xs font-medium text-[var(--c3-text-primary)] truncate">
                          {attachment.filename}
                        </p>
                        <p className="text-[10px] text-[var(--c3-text-tertiary)]">
                          {formatFileSize(attachment.size)}
                        </p>
                      </div>
                      <button
                        onClick={() => onRemoveAttachment(index)}
                        className="p-1 hover:bg-[var(--c3-surface-hover)] rounded transition-colors"
                        type="button"
                      >
                        <X className="w-3 h-3 text-[var(--c3-text-tertiary)]" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="c3-input-container">
        
        <div className="c3-input-wrapper">
          {/* Voice Controls */}
          <VoiceControls
            onTranscript={(text) => {
              onChange(value + (value ? ' ' : '') + text);
              textareaRef.current?.focus();
            }}
            currentMessage={value}
            className="mr-1"
          />
          
          {/* Attachment Button */}
          <button
            type="button"
            onClick={onFileClick}
            className="p-1 rounded-md transition-colors"
            style={{ 
              backgroundColor: 'transparent',
              ':hover': { backgroundColor: 'var(--c3-surface-hover)' }
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--c3-surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            disabled={isLoading}
            title="Attach files (images, PDFs)"
          >
            <Paperclip className="w-4 h-4" style={{ color: 'var(--c3-text-tertiary)' }} />
          </button>

          {/* Input Field */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              if (!e.target.value.startsWith("/")) {
                setShowCommands(false);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? "AI is thinking..." : "Ask anything..."}
            className="c3-input"
            disabled={isLoading}
            rows={1}
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!value.trim() || isLoading}
            className="c3-button c3-button-primary c3-button-icon"
          >
            {isLoading ? (
              <div className="c3-spinner" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Command Suggestions */}
        {filteredCommands.length > 0 && (
          <div className="c3-command-suggestions">
            {filteredCommands.map((cmd) => (
              <button
                key={cmd.command}
                onClick={() => insertCommand(cmd.command + " ")}
                className="c3-command-item"
                type="button"
              >
                <cmd.icon className="w-4 h-4" style={{ color: 'var(--c3-primary)' }} />
                <div className="c3-command-info">
                  <div className="c3-command-name">{cmd.command}</div>
                  <div className="c3-command-desc">{cmd.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Status Bar - Compact */}
      {!isOnline && (
        <div className="c3-input-status">
          <div className="flex items-center justify-center gap-1 text-[10px]" style={{ color: 'var(--c3-warning)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--c3-warning)' }} />
            Offline mode
          </div>
        </div>
      )}
    </div>
  );
}
