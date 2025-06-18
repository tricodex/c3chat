import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, GitBranch, RefreshCw, Edit2 } from "lucide-react";
import { Tooltip } from "./ui/Tooltip";
import { useEnhancedSync } from "../lib/sync-engine-switcher";
import { Id } from "../../convex/_generated/dataModel";

interface MessageActionsProps {
  content: string;
  messageId: string;
  threadId: Id<"threads">;
  role: "user" | "assistant" | "system";
  onEdit?: () => void;
}

export function MessageActions({ content, messageId, threadId, role, onEdit }: MessageActionsProps) {
  const { actions } = useEnhancedSync();
  const [isCopied, setIsCopied] = useState(false);
  const [isBranching, setIsBranching] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      toast.success("Copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy");
    }
  };
  
  const handleBranch = async () => {
    try {
      setIsBranching(true);
      const newThreadId = await actions.createBranch(threadId, messageId);
      toast.success("Created new branch");
      // Navigate to the new branch
      await actions.selectThread(newThreadId);
    } catch (error) {
      toast.error("Failed to create branch");
      console.error(error);
    } finally {
      setIsBranching(false);
    }
  };
  
  const handleRegenerate = async () => {
    try {
      setIsRegenerating(true);
      await actions.regenerateMessage(messageId);
      toast.success("Regenerating response...");
    } catch (error) {
      toast.error("Failed to regenerate response");
      console.error(error);
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="c3-message-actions">
      <Tooltip content="Copy message" position="top">
        <button
          onClick={handleCopy}
          className="c3-message-action"
          aria-label="Copy message"
        >
          {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </Tooltip>
      
      <Tooltip content="Branch from here" position="top">
        <button
          onClick={handleBranch}
          className="c3-message-action"
          aria-label="Branch conversation"
          disabled={isBranching}
        >
          <GitBranch className={`w-3.5 h-3.5 ${isBranching ? 'animate-spin' : ''}`} />
        </button>
      </Tooltip>
      
      {role === "assistant" && (
        <Tooltip content="Regenerate response" position="top">
          <button
            onClick={handleRegenerate}
            className="c3-message-action"
            aria-label="Regenerate response"
            disabled={isRegenerating}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
          </button>
        </Tooltip>
      )}
      
      {role === "user" && onEdit && (
        <Tooltip content="Edit message" position="top">
          <button
            onClick={onEdit}
            className="c3-message-action"
            aria-label="Edit message"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}