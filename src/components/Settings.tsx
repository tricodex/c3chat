import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Input } from './ui/Input';
import { AI_PROVIDERS, COMPANY_LOGOS } from '../lib/ai-providers';
import { toast } from 'sonner';
import { Key, Settings as SettingsIcon, Info, X } from 'lucide-react';
import { 
  OpenAI, 
  Anthropic, 
  Gemini, 
  DeepSeek, 
  Mistral, 
  Cohere, 
  Meta,
  Perplexity
} from '@lobehub/icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Professional AI Provider Logo Component using @lobehub/icons
function CompanyLogo({ providerId, name, size = 20 }: { providerId?: string; name: string; size?: number }) {
  const iconProps = { size, style: { width: size, height: size } };
  
  // Safely access .Color variants with fallbacks
  const renderIcon = (IconComponent: any, fallbackGradient: string, fallbackText: string) => {
    try {
      if (IconComponent?.Color) {
        return <IconComponent.Color {...iconProps} />;
      } else if (IconComponent) {
        return <IconComponent {...iconProps} />;
      }
    } catch (error) {
      // Fallback if icon fails to render
    }
    return (
      <div 
        className={`rounded ${fallbackGradient} flex items-center justify-center text-white font-semibold`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {fallbackText}
      </div>
    );
  };
  
  switch (providerId) {
    case 'openai':
      return renderIcon(OpenAI, 'bg-gradient-to-br from-emerald-500 to-teal-600', 'OAI');
    case 'anthropic':
      return renderIcon(Anthropic, 'bg-gradient-to-br from-orange-500 to-red-600', 'ANT');
    case 'google':
      return renderIcon(Gemini, 'bg-gradient-to-br from-blue-500 to-purple-600', 'GEM');
    case 'deepseek':
      return renderIcon(DeepSeek, 'bg-gradient-to-br from-indigo-500 to-blue-600', 'DS');
    case 'mistral':
      return renderIcon(Mistral, 'bg-gradient-to-br from-orange-500 to-amber-600', 'MIS');
    case 'cohere':
      return renderIcon(Cohere, 'bg-gradient-to-br from-coral-500 to-pink-600', 'COH');
    case 'meta':
      return renderIcon(Meta, 'bg-gradient-to-br from-blue-600 to-indigo-700', 'MET');
    case 'perplexity':
      return renderIcon(Perplexity, 'bg-gradient-to-br from-teal-500 to-cyan-600', 'PPL');
    case 'reka':
      // Reka doesn't have a lobehub icon, use professional fallback
      return (
        <div 
          className="rounded bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-semibold"
          style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
          RK
        </div>
      );
    case 'xai':
      // XAI doesn't have a lobehub icon yet, use a fallback
      return (
        <div 
          className="rounded bg-gradient-to-br from-slate-800 to-black flex items-center justify-center text-white font-semibold"
          style={{ width: size, height: size, fontSize: size * 0.6 }}
        >
          X
        </div>
      );
    case 'openrouter':
      // OpenRouter doesn't have a lobehub icon, use professional fallback
      return (
        <div 
          className="rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold"
          style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
          OR
        </div>
      );
    default:
      return (
        <div 
          className="rounded bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center text-white font-semibold"
          style={{ width: size, height: size, fontSize: size * 0.6 }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
      );
  }
}

export function Settings({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'api-keys' | 'preferences' | 'about'>('api-keys');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [defaultProvider, setDefaultProvider] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = () => {
    // Load API keys from localStorage
    const storedKeys: Record<string, string> = {};
    Object.values(AI_PROVIDERS).forEach(provider => {
      const key = localStorage.getItem(`apiKey_${provider.id}`);
      if (key) storedKeys[provider.id] = key;
    });
    setApiKeys(storedKeys);

    // Load default provider
    const preferred = localStorage.getItem('preferredProvider') || '';
    setDefaultProvider(preferred);
  };

  const handleSaveApiKey = (providerId: string, apiKey: string) => {
    if (apiKey.trim()) {
      localStorage.setItem(`apiKey_${providerId}`, apiKey.trim());
      setApiKeys(prev => ({ ...prev, [providerId]: apiKey.trim() }));
      toast.success(`API key saved for ${AI_PROVIDERS[providerId]?.name}`);
    } else {
      localStorage.removeItem(`apiKey_${providerId}`);
      setApiKeys(prev => {
        const newKeys = { ...prev };
        delete newKeys[providerId];
        return newKeys;
      });
      toast.success(`API key removed for ${AI_PROVIDERS[providerId]?.name}`);
    }
  };

  const handleSetDefaultProvider = (providerId: string) => {
    localStorage.setItem('preferredProvider', providerId);
    setDefaultProvider(providerId);
    toast.success(`Default provider set to ${AI_PROVIDERS[providerId]?.name}`);
  };

  const handleClearAllData = () => {
    if (confirm('Are you sure? This will clear all API keys and preferences.')) {
      setIsLoading(true);
      try {
        // Clear API keys
        Object.keys(AI_PROVIDERS).forEach(providerId => {
          localStorage.removeItem(`apiKey_${providerId}`);
        });
        localStorage.removeItem('preferredProvider');
        localStorage.removeItem('preferredModel');

        setApiKeys({});
        setDefaultProvider('');
        toast.success('All settings cleared');
      } catch (error) {
        toast.error('Failed to clear settings');
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 c3-modal-overlay">
      <div className="c3-glass-heavy rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-[var(--c3-border-subtle)] c3-animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--c3-border-subtle)] bg-[var(--c3-bg-secondary)]">
          <div>
            <h2 className="text-xl font-semibold text-[var(--c3-text-primary)]">Settings</h2>
            <p className="text-sm text-[var(--c3-text-tertiary)] mt-0.5">Manage your AI providers and preferences</p>
          </div>
          <button onClick={onClose} className="c3-button c3-button-ghost c3-button-icon" aria-label="Close settings">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-[var(--c3-border-subtle)] bg-[var(--c3-bg-secondary)]">
          <nav className="flex px-4">
            {[
              { id: 'api-keys', label: 'API Keys', icon: Key },
              { id: 'preferences', label: 'Preferences', icon: SettingsIcon },
              { id: 'about', label: 'About', icon: Info }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[var(--c3-primary)] text-[var(--c3-primary)]'
                    : 'border-transparent text-[var(--c3-text-tertiary)] hover:text-[var(--c3-text-primary)]'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2 inline" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] bg-[var(--c3-bg-primary)] c3-scrollbar">
          {activeTab === 'api-keys' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium text-[var(--c3-text-primary)] mb-3">API Keys</h3>
                <p className="text-xs text-[var(--c3-text-tertiary)] mb-4">
                  Enter your API keys to use the AI providers. Keys are stored locally in your browser.
                </p>
              </div>

              <div className="grid gap-4">
                {Object.values(AI_PROVIDERS).map(provider => (
                  <div key={provider.id} className="p-4 c3-glass-card rounded-lg transition-all hover:transform hover:scale-[1.02]">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <CompanyLogo providerId={provider.id} name={provider.name} size={24} />
                        <div>
                          <h4 className="font-medium text-[var(--c3-text-primary)] text-sm">{provider.name}</h4>
                          <p className="text-xs text-[var(--c3-text-tertiary)]">{provider.description}</p>
                          {provider.freeTier && (
                            <span className="c3-badge text-xs">
                              Free tier available
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col space-y-2 min-w-[240px]">
                        <Input
                          type="password"
                          placeholder={`Enter ${provider.name} API key...`}
                          value={apiKeys[provider.id] || ''}
                          onChange={(e) => setApiKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                          className="text-xs h-8"
                        />
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleSaveApiKey(provider.id, apiKeys[provider.id] || '')}
                            disabled={!apiKeys[provider.id]?.trim()}
                            className="c3-button c3-button-primary text-xs h-6 px-2"
                          >
                            Save
                          </button>
                          {apiKeys[provider.id] && (
                            <button
                              onClick={() => handleSaveApiKey(provider.id, '')}
                              className="c3-button c3-button-ghost text-xs h-6 px-2"
                            >
                              Remove
                            </button>
                          )}
                          <button
                            onClick={() => window.open(provider.apiKeysUrl, '_blank')}
                            className="c3-button c3-button-ghost text-xs h-6 px-2"
                          >
                            Get Key →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium text-[var(--c3-text-primary)] mb-3">Preferences</h3>
                <p className="text-xs text-[var(--c3-text-tertiary)] mb-4">
                  Customize your chat experience and default settings.
                </p>
              </div>

              <div className="p-4 c3-glass-card rounded-lg">
                <h4 className="font-medium text-[var(--c3-text-primary)] mb-2 text-base">Default Provider</h4>
                <p className="text-sm text-[var(--c3-text-tertiary)] mb-4">
                  Choose which AI provider to use by default for new chats.
                </p>
                <div className="space-y-1">
                  {Object.values(AI_PROVIDERS).filter(p => apiKeys[p.id]).map(provider => (
                    <label key={provider.id} className="flex items-center space-x-2 p-2 rounded hover:bg-[var(--c3-surface-hover)] cursor-pointer">
                      <input
                        type="radio"
                        name="defaultProvider"
                        value={provider.id}
                        checked={defaultProvider === provider.id}
                        onChange={() => handleSetDefaultProvider(provider.id)}
                        className="w-3 h-3 text-[var(--c3-primary)]"
                      />
                      <CompanyLogo providerId={provider.id} name={provider.name} size={16} />
                      <span className="text-xs font-medium text-[var(--c3-text-primary)]">{provider.name}</span>
                    </label>
                  ))}
                  {Object.values(AI_PROVIDERS).filter(p => apiKeys[p.id]).length === 0 && (
                    <p className="text-xs text-[var(--c3-text-muted)] italic">Add API keys to see available providers</p>
                  )}
                </div>
              </div>

              <div className="p-4 c3-glass-card rounded-lg">
                <h4 className="font-medium text-[var(--c3-text-primary)] mb-2 text-base">Data Management</h4>
                <p className="text-sm text-[var(--c3-text-tertiary)] mb-4">
                  Manage your local application data and preferences.
                </p>
                <button
                  onClick={handleClearAllData}
                  disabled={isLoading}
                  className="c3-button c3-button-secondary text-xs h-6 px-3 text-[var(--c3-error)] border-[var(--c3-error)]/20 hover:bg-[var(--c3-error)]/10"
                >
                  {isLoading ? 'Clearing...' : 'Clear All Settings'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium text-[var(--c3-text-primary)] mb-3">About C3Chat</h3>
                <p className="text-xs text-[var(--c3-text-tertiary)] mb-4">
                  A modern AI chat application with local-first architecture and real-time sync.
                </p>
              </div>

              <div className="p-6 c3-premium-card rounded-lg">
                <div className="text-center relative z-10">
                  <h1 className="text-2xl font-bold c3-gradient-text mb-2">C3Chat</h1>
                  <p className="text-[var(--c3-text-secondary)] mb-3 text-sm">AI-powered chat with multiple providers</p>
                  <div className="flex justify-center space-x-3 text-xs text-[var(--c3-text-muted)]">
                    <span>Version 1.0.0</span>
                    <span>•</span>
                    <span>Built with React & Convex</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-[var(--c3-border-subtle)]">
                    <h4 className="font-medium text-[var(--c3-text-primary)] mb-2 text-sm">Supported Providers</h4>
                    <div className="flex flex-wrap justify-center gap-3">
                      {Object.values(AI_PROVIDERS).map(provider => (
                        <div key={provider.id} className="flex items-center space-x-1 text-xs text-[var(--c3-text-secondary)]">
                          <CompanyLogo providerId={provider.id} name={provider.name} size={14} />
                          <span>{provider.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--c3-border-subtle)] p-4 bg-[var(--c3-bg-secondary)] flex justify-end">
          <button onClick={onClose} className="c3-button c3-button-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
