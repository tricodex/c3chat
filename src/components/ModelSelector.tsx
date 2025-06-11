import { useState, useEffect } from 'react';
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
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showWebSearchInfo, setShowWebSearchInfo] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [pendingProvider, setPendingProvider] = useState<string>('');

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
      } else {
        // No defaults available - show provider selection
        setShowProviderModal(true);
      }
    }
  }, [currentProvider, currentModel]);

  const provider = selectedProvider ? AI_PROVIDERS[selectedProvider] : null;
  const model = provider?.models.find(m => m.id === selectedModel);

  const handleProviderChange = (providerId: string) => {
    const newProvider = AI_PROVIDERS[providerId];
    if (!newProvider) return;

    // Check if provider requires API key
    if (newProvider.requiresApiKey && !hasValidApiKey(providerId)) {
      setPendingProvider(providerId);
      setShowApiKeyModal(true);
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
    
    setShowProviderModal(false);
  };

  const handleModelChange = (modelId: string) => {
    if (!provider) return;
    
    setSelectedModel(modelId);
    onSelect(selectedProvider, modelId);
    
    // Save preference
    setPreferredModel(selectedProvider, modelId);
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
    handleProviderChange(pendingProvider);
    setPendingProvider('');
  };

  const { featured, popular, others } = getProvidersByCategory();

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowProviderModal(true)}
          className="btn btn-secondary btn-sm"
        >
          {provider ? provider.name : 'Select Provider'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {provider && model && (
          <span className="badge">
            {model.name}
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">AI Model</h3>
          <button
            onClick={() => setShowWebSearchInfo(true)}
            className="btn btn-ghost btn-sm"
            title="Web Search Info"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>

        {!provider ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">🤖</div>
            <h4 className="text-lg font-medium text-foreground mb-2">Choose Your AI</h4>
            <p className="text-muted text-sm mb-4">Select a provider to get started</p>
            <button
              onClick={() => setShowProviderModal(true)}
              className="btn btn-primary"
            >
              Browse AI Providers
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current Selection */}
            <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border">
              <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                <span className="text-lg">🤖</span>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-foreground">{provider.name}</h4>
                  {provider.freeTier && (
                    <span className="badge bg-success/10 text-success border-success/20">
                      Free Tier
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted">{provider.description}</p>
              </div>
              
              <button
                onClick={() => setShowProviderModal(true)}
                className="btn btn-ghost btn-sm"
              >
                Change
              </button>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="input"
              >
                {provider.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} {model.recommended ? '⭐' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Model Info */}
            {model && (
              <div className="p-3 bg-surface-sunken rounded-lg border border-border-subtle">
                <div className="space-y-2">
                  {model.description && (
                    <p className="text-sm text-foreground">{model.description}</p>
                  )}
                  
                  <div className="flex items-center gap-4 text-xs text-muted">
                    <span>Context: {formatContextLength(model.contextLength)}</span>
                    {model.pricing && (
                      <span>Pricing: {formatPricing(model.pricing)}</span>
                    )}
                  </div>

                  {model.strengths && model.strengths.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {model.strengths.map((strength, i) => (
                        <span key={i} className="badge text-xs">
                          {strength}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* API Key Status */}
            {provider.requiresApiKey && (
              <div className="flex items-center justify-between p-3 bg-surface rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    hasValidApiKey(selectedProvider) ? 'bg-success' : 'bg-warning'
                  }`} />
                  <span className="text-sm text-foreground">
                    API Key {hasValidApiKey(selectedProvider) ? 'Configured' : 'Required'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setPendingProvider(selectedProvider);
                    setShowApiKeyModal(true);
                  }}
                  className={`btn btn-sm ${
                    hasValidApiKey(selectedProvider) ? 'btn-ghost' : 'btn-primary'
                  }`}
                >
                  {hasValidApiKey(selectedProvider) ? 'Update' : 'Add Key'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Provider Selection Modal */}
      {showProviderModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-foreground">Choose AI Provider</h2>
                <button
                  onClick={() => setShowProviderModal(false)}
                  className="btn btn-ghost btn-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Featured Providers */}
              {featured.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-foreground mb-4">⭐ Featured</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {featured.map((provider) => (
                      <ProviderCard
                        key={provider.id}
                        provider={provider}
                        onSelect={handleProviderChange}
                        isSelected={selectedProvider === provider.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Providers */}
              {popular.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-foreground mb-4">🔥 Popular</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {popular.map((provider) => (
                      <ProviderCard
                        key={provider.id}
                        provider={provider}
                        onSelect={handleProviderChange}
                        isSelected={selectedProvider === provider.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Other Providers */}
              {others.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">🤖 More Options</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {others.map((provider) => (
                      <ProviderCard
                        key={provider.id}
                        provider={provider}
                        onSelect={handleProviderChange}
                        isSelected={selectedProvider === provider.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      {showApiKeyModal && pendingProvider && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-foreground mb-4">
              Enter {AI_PROVIDERS[pendingProvider]?.name} API Key
            </h3>
            
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="input mb-4"
              autoFocus
            />

            <div className="text-sm text-muted mb-6">
              <p className="mb-2">Get your API key from:</p>
              <a
                href={AI_PROVIDERS[pendingProvider]?.apiKeysUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-primary hover:underline"
              >
                {AI_PROVIDERS[pendingProvider]?.name} Dashboard →
              </a>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowApiKeyModal(false);
                  setApiKey('');
                  setPendingProvider('');
                }}
                className="btn btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleApiKeySave}
                disabled={!apiKey.trim()}
                className="btn btn-primary flex-1"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Web Search Info Modal */}
      {showWebSearchInfo && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-foreground">🔍 Web Search APIs</h2>
              <button
                onClick={() => setShowWebSearchInfo(false)}
                className="btn btn-ghost btn-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-muted mb-6">
              To enable web search capabilities, you'll need an API key from one of these providers:
            </p>

            <div className="space-y-4">
              {Object.entries(WEB_SEARCH_PROVIDERS).map(([id, provider]) => (
                <div key={id} className="p-4 bg-surface-sunken rounded-lg border border-border-subtle">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-foreground">{provider.name}</h3>
                    <span className="text-xs text-muted">{provider.pricing}</span>
                  </div>
                  
                  <p className="text-sm text-muted mb-3">{provider.description}</p>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {provider.features.map((feature, i) => (
                      <span key={i} className="badge text-xs">
                        {feature}
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <a
                      href={provider.signupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                    >
                      Get API Key
                    </a>
                    <a
                      href={provider.apiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                    >
                      Documentation
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProviderCard({ 
  provider, 
  onSelect, 
  isSelected 
}: { 
  provider: AIProvider; 
  onSelect: (id: string) => void; 
  isSelected: boolean; 
}) {
  const hasApiKey = provider.requiresApiKey ? hasValidApiKey(provider.id) : true;
  
  return (
    <button
      onClick={() => onSelect(provider.id)}
      className={`
        card card-interactive text-left p-4 transition-smooth
        ${isSelected ? 'border-brand-primary bg-brand-primary/5' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center shrink-0">
          <span className="text-lg">🤖</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-foreground">{provider.name}</h4>
            {provider.freeTier && (
              <span className="badge bg-success/10 text-success border-success/20 text-xs">
                Free
              </span>
            )}
          </div>
          
          <p className="text-sm text-muted mb-2 line-clamp-2">{provider.description}</p>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-subtle">
              {provider.models.length} model{provider.models.length !== 1 ? 's' : ''}
            </span>
            
            {provider.requiresApiKey && (
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${
                  hasApiKey ? 'bg-success' : 'bg-warning'
                }`} />
                <span className="text-xs text-muted">
                  {hasApiKey ? 'Ready' : 'Key needed'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
