import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { 
  AI_PROVIDERS, 
  WEB_SEARCH_PROVIDERS,
  type AIProvider, 
  type AIModel, 
  getStoredApiKey, 
  setStoredApiKey, 
  hasValidApiKey,
  getDefaultProvider,
  setPreferredProvider,
  setPreferredModel,
  formatPricing,
  formatContextLength,
  getProvidersByCategory
} from '../lib/ai-providers';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
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
import { ChevronDown, Check, Search, Sparkles, Zap, Globe, Code, Brain, Image, Key, ExternalLink } from 'lucide-react';

// Professional AI Provider Logo Component using @lobehub/icons
function ProviderLogo({ providerId, name, size = 20 }: { providerId?: string; name: string; size?: number }) {
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
        className={`rounded-lg ${fallbackGradient} flex items-center justify-center text-white font-semibold`}
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
          className="rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-semibold"
          style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
          RK
        </div>
      );
    case 'xai':
      // XAI doesn't have a lobehub icon yet, use a fallback
      return (
        <div 
          className="rounded-lg bg-gradient-to-br from-slate-800 to-black flex items-center justify-center text-white font-semibold"
          style={{ width: size, height: size, fontSize: size * 0.6 }}
        >
          X
        </div>
      );
    case 'openrouter':
      // OpenRouter doesn't have a lobehub icon, use professional fallback
      return (
        <div 
          className="rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold"
          style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
          OR
        </div>
      );
    default:
      return (
        <div 
          className="rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center text-white font-semibold"
          style={{ width: size, height: size, fontSize: size * 0.6 }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
      );
  }
}

interface ModelSelectorProps {
  currentProvider?: string;
  currentModel?: string;
  onSelect: (provider: string, model: string) => void;
  compact?: boolean;
}

export function ModelSelector({ 
  currentProvider, 
  currentModel, 
  onSelect, 
  compact = false 
}: ModelSelectorProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [pendingProvider, setPendingProvider] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize with smart defaults or current selection
  useEffect(() => {
    if (currentProvider && currentModel) {
      setSelectedProvider(currentProvider);
      setSelectedModel(currentModel);
    } else {
      // Try to get smart default
      const defaultSelection = getDefaultProvider();
      if (defaultSelection) {
        setSelectedProvider(defaultSelection.providerId);
        setSelectedModel(defaultSelection.modelId);
        onSelect(defaultSelection.providerId, defaultSelection.modelId);
      }
    }
  }, [currentProvider, currentModel]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const provider = selectedProvider ? AI_PROVIDERS[selectedProvider] : null;
  const model = provider?.models.find(m => m.id === selectedModel);

  const handleProviderSelect = (providerId: string) => {
    const newProvider = AI_PROVIDERS[providerId];
    if (!newProvider) return;

    // Check if provider requires API key
    if (newProvider.requiresApiKey && !hasValidApiKey(providerId)) {
      setPendingProvider(providerId);
      setShowApiKeyModal(true);
      setShowDropdown(false);
      return;
    }

    // Set provider and default model
    setSelectedProvider(providerId);
    const defaultModel = newProvider.models.find(m => m.recommended)?.id || newProvider.models[0]?.id;
    if (defaultModel) {
      setSelectedModel(defaultModel);
      onSelect(providerId, defaultModel);
      
      // Save preferences
      setPreferredProvider(providerId);
      setPreferredModel(providerId, defaultModel);
    }
  };

  const handleModelSelect = (modelId: string) => {
    if (!provider) return;
    
    setSelectedModel(modelId);
    onSelect(selectedProvider, modelId);
    
    // Save preference
    setPreferredModel(selectedProvider, modelId);
    setShowDropdown(false);
  };

  const handleApiKeySave = () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    setStoredApiKey(pendingProvider, apiKey.trim());
    setShowApiKeyModal(false);
    setApiKey('');
    toast.success(`${AI_PROVIDERS[pendingProvider]?.name} API key saved!`);
    
    // Now set the provider
    handleProviderSelect(pendingProvider);
    setPendingProvider('');
  };

  const { featured, popular, others } = getProvidersByCategory();

  // Filter providers and models based on search
  const filteredProviders = Object.values(AI_PROVIDERS).filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.models.some(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (compact) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-1.5 bg-[var(--c3-surface-primary)] border border-[var(--c3-border-subtle)] rounded-lg hover:border-[var(--c3-primary)] transition-all text-sm"
        >
          {provider && model ? (
            <>
              <ProviderLogo providerId={provider.id} name={provider.name} size={16} />
              <span className="text-[var(--c3-text-primary)] font-medium hidden sm:inline">
                {model.name}
              </span>
              <span className="text-[var(--c3-text-primary)] font-medium sm:hidden">
                {provider.name}
              </span>
            </>
          ) : (
            <span className="text-[var(--c3-text-tertiary)]">Select Model</span>
          )}
          <ChevronDown className="w-4 h-4 text-[var(--c3-text-tertiary)]" />
        </button>

        {showDropdown && (
          <ElaborateDropdown
            providers={filteredProviders}
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onProviderSelect={handleProviderSelect}
            onModelSelect={handleModelSelect}
            onClose={() => setShowDropdown(false)}
          />
        )}

        {/* API Key Modal */}
        {showApiKeyModal && pendingProvider && (
          <ApiKeyModal
            provider={AI_PROVIDERS[pendingProvider]}
            apiKey={apiKey}
            setApiKey={setApiKey}
            onSave={handleApiKeySave}
            onCancel={() => {
              setShowApiKeyModal(false);
              setApiKey('');
              setPendingProvider('');
            }}
          />
        )}
      </div>
    );
  }

  // Full size model selector (non-compact)
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>AI Model Selection</CardTitle>
        <p className="text-muted text-sm">Choose your AI provider and model</p>
      </CardHeader>
      
      <CardContent>
        {/* Content for full-size selector */}
        <div className="space-y-4">
          <Input
            type="text"
            placeholder="Search providers and models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
          
          {/* Provider and model selection UI */}
          <div className="grid gap-4">
            {filteredProviders.map(provider => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                isSelected={selectedProvider === provider.id}
                selectedModel={selectedModel}
                onProviderSelect={handleProviderSelect}
                onModelSelect={handleModelSelect}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Elaborate dropdown component
function ElaborateDropdown({
  providers,
  selectedProvider,
  selectedModel,
  searchQuery,
  setSearchQuery,
  onProviderSelect,
  onModelSelect,
  onClose
}: {
  providers: AIProvider[];
  selectedProvider: string;
  selectedModel: string;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onProviderSelect: (id: string) => void;
  onModelSelect: (id: string) => void;
  onClose: () => void;
}) {
  const currentProvider = selectedProvider ? AI_PROVIDERS[selectedProvider] : null;
  
  return (
    <div className="absolute top-full mt-2 right-0 w-[480px] max-h-[600px] bg-[var(--c3-bg-elevated)] border border-[var(--c3-border-primary)] rounded-xl shadow-2xl overflow-hidden c3-glass-heavy c3-elaborate-dropdown">
      {/* Search Header */}
      <div className="p-4 border-b border-[var(--c3-border-subtle)] bg-[var(--c3-bg-secondary)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--c3-text-tertiary)]" />
          <input
            type="text"
            placeholder="Search providers and models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[var(--c3-surface-primary)] border border-[var(--c3-border-subtle)] rounded-lg text-sm text-[var(--c3-text-primary)] placeholder-[var(--c3-text-tertiary)] focus:outline-none focus:border-[var(--c3-primary)]"
            autoFocus
          />
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto max-h-[500px] c3-scrollbar">
        {/* Current Selection */}
        {currentProvider && (
          <div className="p-4 bg-[var(--c3-surface-primary)] border-b border-[var(--c3-border-subtle)]">
            <div className="flex items-center gap-3">
              <ProviderLogo providerId={currentProvider.id} name={currentProvider.name} size={32} />
              <div className="flex-1">
                <h4 className="font-semibold text-[var(--c3-text-primary)]">{currentProvider.name}</h4>
                <p className="text-xs text-[var(--c3-text-tertiary)]">{currentProvider.description}</p>
              </div>
              {currentProvider.requiresApiKey && (
                <div className={`w-2 h-2 rounded-full ${
                  hasValidApiKey(currentProvider.id) ? 'bg-[var(--c3-success)]' : 'bg-[var(--c3-warning)]'
                }`} />
              )}
            </div>

            {/* Models for current provider */}
            <div className="mt-4 space-y-1">
              {currentProvider.models.map(model => (
                <button
                  key={model.id}
                  onClick={() => onModelSelect(model.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                    selectedModel === model.id 
                      ? 'bg-[var(--c3-primary)]/10 border border-[var(--c3-primary)]' 
                      : 'hover:bg-[var(--c3-surface-hover)]'
                  }`}
                >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-[var(--c3-text-primary)]">
                        {model.name}
                      </span>
                      {model.recommended && <Sparkles className="w-3 h-3 text-[var(--c3-warning)]" />}
                    </div>
                    {model.description && (
                      <p className="text-xs text-[var(--c3-text-tertiary)] mt-0.5">{model.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-[var(--c3-text-muted)]">
                        {formatContextLength(model.contextLength)}
                      </span>
                      {model.pricing && (
                        <span className="text-xs text-[var(--c3-text-muted)]">
                          {formatPricing(model.pricing)}
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedModel === model.id && (
                    <Check className="w-4 h-4 text-[var(--c3-primary)]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* All Providers */}
        <div className="p-4">
          <h3 className="text-xs font-semibold text-[var(--c3-text-secondary)] uppercase tracking-wider mb-3">
            All Providers
          </h3>
          
          <div className="space-y-2">
            {providers.map(provider => (
              <button
                key={provider.id}
                onClick={() => onProviderSelect(provider.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                  selectedProvider === provider.id
                    ? 'bg-[var(--c3-surface-primary)] border border-[var(--c3-primary)]'
                    : 'hover:bg-[var(--c3-surface-hover)]'
                }`}
              >
                <ProviderLogo providerId={provider.id} name={provider.name} size={40} />
                
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-[var(--c3-text-primary)]">
                      {provider.name}
                    </h4>
                    {provider.featured && <Sparkles className="w-3 h-3 text-[var(--c3-warning)]" />}
                    {provider.freeTier && (
                      <span className="text-xs px-2 py-0.5 bg-[var(--c3-success)]/10 text-[var(--c3-success)] rounded-full">
                        Free
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--c3-text-tertiary)] mt-0.5">
                    {provider.description}
                  </p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-[var(--c3-text-muted)]">
                      {provider.models.length} models
                    </span>
                    {provider.supportsImages && <Image className="w-3 h-3 text-[var(--c3-text-muted)]" />}
                    {provider.supportsTools && <Code className="w-3 h-3 text-[var(--c3-text-muted)]" />}
                    {provider.supportsWebSearch && <Globe className="w-3 h-3 text-[var(--c3-text-muted)]" />}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {provider.requiresApiKey && (
                    <div className={`flex items-center gap-1 text-xs ${
                      hasValidApiKey(provider.id) 
                        ? 'text-[var(--c3-success)]' 
                        : 'text-[var(--c3-warning)]'
                    }`}>
                      <Key className="w-3 h-3" />
                      {hasValidApiKey(provider.id) ? 'Ready' : 'Key needed'}
                    </div>
                  )}
                  {selectedProvider === provider.id && (
                    <Check className="w-4 h-4 text-[var(--c3-primary)]" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[var(--c3-border-subtle)] bg-[var(--c3-bg-secondary)] flex items-center justify-between">
        <span className="text-xs text-[var(--c3-text-tertiary)]">
          {providers.length} providers available
        </span>
        <button
          onClick={onClose}
          className="text-xs text-[var(--c3-text-secondary)] hover:text-[var(--c3-text-primary)]"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// Provider card component for full-size selector
function ProviderCard({
  provider,
  isSelected,
  selectedModel,
  onProviderSelect,
  onModelSelect
}: {
  provider: AIProvider;
  isSelected: boolean;
  selectedModel: string;
  onProviderSelect: (id: string) => void;
  onModelSelect: (id: string) => void;
}) {
  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${
      isSelected ? 'border-[var(--c3-primary)] shadow-lg' : 'border-[var(--c3-border-subtle)]'
    }`}>
      <button
        onClick={() => onProviderSelect(provider.id)}
        className="w-full p-4 flex items-center gap-4 hover:bg-[var(--c3-surface-hover)] transition-colors"
      >
        <ProviderLogo providerId={provider.id} name={provider.name} size={48} />
        
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-[var(--c3-text-primary)]">
              {provider.name}
            </h3>
            {provider.featured && <Sparkles className="w-4 h-4 text-[var(--c3-warning)]" />}
            {provider.freeTier && (
              <span className="text-xs px-2 py-1 bg-[var(--c3-success)]/10 text-[var(--c3-success)] rounded-full">
                Free tier
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--c3-text-secondary)] mt-1">
            {provider.description}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs text-[var(--c3-text-muted)]">
              {provider.models.length} models available
            </span>
            <div className="flex items-center gap-2">
              {provider.supportsImages && (
                <div className="flex items-center gap-1 text-xs text-[var(--c3-text-muted)]">
                  <Image className="w-3 h-3" />
                  <span>Images</span>
                </div>
              )}
              {provider.supportsTools && (
                <div className="flex items-center gap-1 text-xs text-[var(--c3-text-muted)]">
                  <Code className="w-3 h-3" />
                  <span>Tools</span>
                </div>
              )}
              {provider.supportsWebSearch && (
                <div className="flex items-center gap-1 text-xs text-[var(--c3-text-muted)]">
                  <Globe className="w-3 h-3" />
                  <span>Search</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {provider.requiresApiKey && (
            <div className={`px-3 py-1 rounded-full text-xs flex items-center gap-1 ${
              hasValidApiKey(provider.id)
                ? 'bg-[var(--c3-success)]/10 text-[var(--c3-success)]'
                : 'bg-[var(--c3-warning)]/10 text-[var(--c3-warning)]'
            }`}>
              <Key className="w-3 h-3" />
              {hasValidApiKey(provider.id) ? 'Configured' : 'Key required'}
            </div>
          )}
          <ChevronDown className={`w-5 h-5 text-[var(--c3-text-tertiary)] transition-transform ${
            isSelected ? 'rotate-180' : ''
          }`} />
        </div>
      </button>

      {isSelected && (
        <div className="border-t border-[var(--c3-border-subtle)] p-4 bg-[var(--c3-surface-primary)]">
          <h4 className="text-sm font-semibold text-[var(--c3-text-primary)] mb-3">
            Available Models
          </h4>
          <div className="space-y-2">
            {provider.models.map(model => (
              <button
                key={model.id}
                onClick={() => onModelSelect(model.id)}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                  selectedModel === model.id
                    ? 'bg-[var(--c3-primary)]/10 border border-[var(--c3-primary)]'
                    : 'border border-[var(--c3-border-subtle)] hover:bg-[var(--c3-surface-hover)]'
                }`}
              >
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--c3-text-primary)]">
                      {model.name}
                    </span>
                    {model.recommended && (
                      <span className="text-xs px-2 py-0.5 bg-[var(--c3-warning)]/10 text-[var(--c3-warning)] rounded-full flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Recommended
                      </span>
                    )}
                  </div>
                  {model.description && (
                    <p className="text-xs text-[var(--c3-text-tertiary)] mt-1">
                      {model.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-[var(--c3-text-muted)]">
                      Context: {formatContextLength(model.contextLength)}
                    </span>
                    {model.pricing && (
                      <span className="text-xs text-[var(--c3-text-muted)]">
                        {formatPricing(model.pricing)}
                      </span>
                    )}
                    {model.maxOutputTokens && (
                      <span className="text-xs text-[var(--c3-text-muted)]">
                        Max output: {model.maxOutputTokens.toLocaleString()} tokens
                      </span>
                    )}
                  </div>
                  {model.strengths && model.strengths.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {model.strengths.map((strength, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-[var(--c3-surface-secondary)] rounded-full text-[var(--c3-text-secondary)]">
                          {strength}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {selectedModel === model.id && (
                  <Check className="w-5 h-5 text-[var(--c3-primary)] flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {provider.requiresApiKey && !hasValidApiKey(provider.id) && (
            <div className="mt-4 p-3 bg-[var(--c3-warning)]/10 border border-[var(--c3-warning)]/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-[var(--c3-warning)]" />
                  <span className="text-sm text-[var(--c3-warning)]">
                    API key required to use this provider
                  </span>
                </div>
                <a
                  href={provider.apiKeysUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-[var(--c3-primary)] hover:underline"
                >
                  Get API key
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// API Key Modal
function ApiKeyModal({
  provider,
  apiKey,
  setApiKey,
  onSave,
  onCancel
}: {
  provider: AIProvider;
  apiKey: string;
  setApiKey: (key: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--c3-bg-elevated)] rounded-xl shadow-2xl max-w-md w-full p-6 c3-glass-heavy">
        <div className="flex items-center gap-4 mb-4">
          <ProviderLogo providerId={provider.id} name={provider.name} size={48} />
          <div>
            <h3 className="text-lg font-semibold text-[var(--c3-text-primary)]">
              Enter {provider.name} API Key
            </h3>
            <p className="text-sm text-[var(--c3-text-tertiary)]">
              Required to use this provider
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--c3-text-secondary)] mb-2">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-2 bg-[var(--c3-surface-primary)] border border-[var(--c3-border-subtle)] rounded-lg text-[var(--c3-text-primary)] placeholder-[var(--c3-text-tertiary)] focus:outline-none focus:border-[var(--c3-primary)]"
              autoFocus
            />
          </div>

          <div className="p-3 bg-[var(--c3-surface-primary)] rounded-lg">
            <p className="text-sm text-[var(--c3-text-secondary)] mb-2">
              Get your API key from:
            </p>
            <a
              href={provider.apiKeysUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-[var(--c3-primary)] hover:underline"
            >
              {provider.name} Dashboard
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-[var(--c3-surface-primary)] border border-[var(--c3-border-primary)] rounded-lg text-[var(--c3-text-primary)] hover:bg-[var(--c3-surface-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={!apiKey.trim()}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-[var(--c3-primary)] to-[var(--c3-electric)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
