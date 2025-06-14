import { useState, useRef, KeyboardEvent } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { Paperclip, Send, Sparkles, Globe, Command, X, Mic, Image, FileText } from "lucide-react";
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
      {attachments.length > 0 && (
      <div className="flex gap-2 mb-3 flex-wrap">
      {attachments.map((_, index) => (
      <div key={index} className="c3-attachment-preview">
      <Paperclip className="w-4 h-4" style={{ color: 'var(--c3-text-secondary)' }} />
      <button
      onClick={() => onRemoveAttachment(index)}
      className="c3-attachment-remove"
      type="button"
      >
      <X className="w-3 h-3" />
      </button>
      </div>
      ))}
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
