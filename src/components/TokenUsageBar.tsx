import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Zap, TrendingUp, DollarSign } from "lucide-react";
import { formatContextLength } from "../lib/ai-providers";

interface TokenUsageBarProps {
  threadId: Id<"threads">;
}

export function TokenUsageBar({ threadId }: TokenUsageBarProps) {
  const [showDetails, setShowDetails] = useState(false);
  const messages = useQuery(api.messages.list, { threadId });
  
  // Calculate token usage
  const tokenStats = messages?.reduce((acc, msg) => {
    if (msg.role === "assistant") {
      acc.totalInput += msg.inputTokens || 0;
      acc.totalOutput += msg.outputTokens || 0;
      acc.messageCount += 1;
    }
    return acc;
  }, { totalInput: 0, totalOutput: 0, messageCount: 0 }) || { totalInput: 0, totalOutput: 0, messageCount: 0 };

  const totalTokens = tokenStats.totalInput + tokenStats.totalOutput;
  
  // Estimate cost (using average pricing)
  const estimatedCost = (tokenStats.totalInput * 2.5 + tokenStats.totalOutput * 10) / 1000000;
  
  // Calculate percentage of typical context window (128k)
  const contextPercentage = Math.min((totalTokens / 128000) * 100, 100);

  if (totalTokens === 0) {
    return null;
  }

  return (
    <div className="c3-token-usage-bar">
      <div 
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[var(--c3-surface-hover)] transition-colors"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--c3-warning)]" />
            <span className="text-xs font-medium text-[var(--c3-text-secondary)]">
              {formatContextLength(totalTokens)} used
            </span>
          </div>
          
          <div className="h-1.5 w-32 bg-[var(--c3-surface-secondary)] rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[var(--c3-primary)] to-[var(--c3-electric)] transition-all duration-300"
              style={{ width: `${contextPercentage}%` }}
            />
          </div>
          
          <span className="text-xs text-[var(--c3-text-tertiary)]">
            {contextPercentage.toFixed(1)}% of context
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-[var(--c3-success)]" />
            <span className="text-xs text-[var(--c3-text-secondary)]">
              ~${estimatedCost.toFixed(4)}
            </span>
          </div>
          
          <TrendingUp className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        </div>
      </div>
      
      {showDetails && (
        <div className="px-3 py-2 border-t border-[var(--c3-border-subtle)] bg-[var(--c3-surface-primary)]">
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-[var(--c3-text-tertiary)] mb-1">Input Tokens</div>
              <div className="font-medium text-[var(--c3-text-primary)]">
                {tokenStats.totalInput.toLocaleString()}
              </div>
              <div className="text-[var(--c3-text-muted)]">
                ~${((tokenStats.totalInput * 2.5) / 1000000).toFixed(4)}
              </div>
            </div>
            
            <div>
              <div className="text-[var(--c3-text-tertiary)] mb-1">Output Tokens</div>
              <div className="font-medium text-[var(--c3-text-primary)]">
                {tokenStats.totalOutput.toLocaleString()}
              </div>
              <div className="text-[var(--c3-text-muted)]">
                ~${((tokenStats.totalOutput * 10) / 1000000).toFixed(4)}
              </div>
            </div>
            
            <div>
              <div className="text-[var(--c3-text-tertiary)] mb-1">Messages</div>
              <div className="font-medium text-[var(--c3-text-primary)]">
                {tokenStats.messageCount}
              </div>
              <div className="text-[var(--c3-text-muted)]">
                ~{Math.round(totalTokens / Math.max(tokenStats.messageCount, 1))} avg
              </div>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-[var(--c3-border-subtle)]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--c3-text-tertiary)]">
                Token efficiency
              </span>
              <span className="text-xs font-medium text-[var(--c3-primary)]">
                {((tokenStats.totalOutput / Math.max(tokenStats.totalInput, 1)) * 100).toFixed(0)}% output ratio
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
