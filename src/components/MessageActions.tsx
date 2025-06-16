import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { Tooltip } from "./ui/Tooltip";

interface MessageActionsProps {
  content: string;
  messageId: string;
}

export function MessageActions({ content, messageId }: MessageActionsProps) {
  const [isCopied, setIsCopied] = useState(false);

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
    </div>
  );
}