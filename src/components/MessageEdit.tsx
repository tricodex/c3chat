import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { useEnhancedSync } from "../lib/corrected-sync-engine";

interface MessageEditProps {
  messageId: string;
  initialContent: string;
  onCancel: () => void;
  onSave: () => void;
}

export function MessageEdit({ messageId, initialContent, onCancel, onSave }: MessageEditProps) {
  const { actions } = useEnhancedSync();
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(content.length, content.length);
      
      // Auto-resize textarea
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, []);

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error("Message cannot be empty");
      return;
    }

    if (content === initialContent) {
      onCancel();
      return;
    }

    try {
      setIsSaving(true);
      await actions.updateMessage(messageId, { content });
      toast.success("Message updated");
      onSave();
    } catch (error) {
      toast.error("Failed to update message");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  return (
    <div className="c3-message-edit">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        className="c3-edit-textarea"
        placeholder="Edit message..."
        rows={1}
        disabled={isSaving}
      />
      <div className="c3-edit-actions">
        <button
          onClick={handleSave}
          className="c3-edit-save"
          disabled={isSaving || !content.trim()}
          title="Save (Enter)"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={onCancel}
          className="c3-edit-cancel"
          disabled={isSaving}
          title="Cancel (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}