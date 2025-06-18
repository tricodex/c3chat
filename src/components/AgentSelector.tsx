import React, { useState } from "react";
import { ChevronDown, Sparkles, Brain, Check, Microscope, Code2, Palette, BarChart3, GraduationCap, Briefcase, Bot, Lightbulb } from "lucide-react";
import { AI_AGENTS, AIAgent } from "../lib/ai-agents";
import { useEnhancedSync } from "../lib/sync-engine-switcher";
import { toast } from "sonner";

// Map icon names to Lucide components
const ICON_MAP: { [key: string]: React.ComponentType<{ className?: string }> } = {
  Microscope,
  Code2,
  Palette,
  BarChart3,
  GraduationCap,
  Briefcase,
  Brain,
  Bot,
  Lightbulb,
};

interface AgentSelectorProps {
  currentAgentId?: string;
  onSelect: (agentId: string) => void;
  className?: string;
}

export function AgentSelector({ currentAgentId = 'assistant', onSelect, className = '' }: AgentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { actions, state } = useEnhancedSync();
  const currentAgent = AI_AGENTS[currentAgentId] || AI_AGENTS.assistant;

  const handleAgentSelect = async (agentId: string) => {
    onSelect(agentId);
    setIsOpen(false);

    // Update thread with agent preference if a thread is selected
    if (state.selectedThreadId) {
      try {
        await actions.updateThread(state.selectedThreadId, {
          agentId,
        });
        toast.success(`Switched to ${AI_AGENTS[agentId].name}`);
      } catch (error) {
        console.error('Failed to update thread agent:', error);
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--c3-surface-secondary)] hover:bg-[var(--c3-surface-hover)] transition-all border border-[var(--c3-border-subtle)]"
      >
        {ICON_MAP[currentAgent.iconName] && (
          <div className="w-8 h-8 rounded-lg bg-[var(--c3-gradient-primary)] flex items-center justify-center">
            {React.createElement(ICON_MAP[currentAgent.iconName], {
              className: "w-5 h-5 text-white",
            })}
          </div>
        )}
        <div className="text-left">
          <div className="text-sm font-medium text-[var(--c3-text-primary)] flex items-center gap-1">
            {currentAgent.name}
            <Sparkles className="w-3 h-3 text-[var(--c3-primary)]" />
          </div>
          <div className="text-xs text-[var(--c3-text-tertiary)]">
            {currentAgent.capabilities.slice(0, 2).join(', ')}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-80 max-h-[400px] overflow-y-auto rounded-xl bg-[var(--c3-surface-primary)] border border-[var(--c3-border)] shadow-xl z-50">
            <div className="p-3 border-b border-[var(--c3-border-subtle)]">
              <h3 className="text-sm font-semibold text-[var(--c3-text-primary)] flex items-center gap-2">
                <Brain className="w-4 h-4" />
                AI Agents
              </h3>
              <p className="text-xs text-[var(--c3-text-tertiary)] mt-1">
                Choose a specialized agent for your task
              </p>
            </div>

            <div className="p-2">
              {Object.values(AI_AGENTS).map((agent: AIAgent) => (
                <button
                  key={agent.id}
                  onClick={() => handleAgentSelect(agent.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg hover:bg-[var(--c3-surface-hover)] transition-all ${
                    currentAgentId === agent.id ? 'bg-[var(--c3-primary)]/10 border border-[var(--c3-primary)]/30' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--c3-gradient-primary)] flex items-center justify-center flex-shrink-0">
                    {ICON_MAP[agent.iconName] && 
                      React.createElement(ICON_MAP[agent.iconName], {
                        className: "w-5 h-5 text-white",
                      })
                    }
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-[var(--c3-text-primary)]">
                        {agent.name}
                      </h4>
                      {currentAgentId === agent.id && (
                        <Check className="w-4 h-4 text-[var(--c3-primary)]" />
                      )}
                    </div>
                    <p className="text-xs text-[var(--c3-text-secondary)] mt-0.5">
                      {agent.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {agent.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="px-2 py-0.5 text-xs rounded-full bg-[var(--c3-surface-secondary)] text-[var(--c3-text-tertiary)]"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                    {agent.personality && (
                      <p className="text-xs text-[var(--c3-text-tertiary)] mt-2 italic">
                        {agent.personality}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="p-3 border-t border-[var(--c3-border-subtle)] bg-[var(--c3-surface-secondary)]/50">
              <p className="text-xs text-[var(--c3-text-tertiary)] flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                Agents automatically adjust model settings and context for optimal performance
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
