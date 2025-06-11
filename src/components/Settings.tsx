import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  AI_PROVIDERS, 
  type AIProvider,
  getStoredApiKey, 
  setStoredApiKey,
  removeStoredApiKey,
  hasValidApiKey,
  getDefaultProvider,
  setPreferredProvider,
  setPreferredModel
} from '../lib/ai-providers';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Settings({ isOpen, onClose }: SettingsProps) {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [defaultProvider, setDefaultProvider] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');

  useEffect(() => {
    if (isOpen) {
      // Load current API keys
      const keys: Record<string, string> = {};
      Object.keys(AI_PROVIDERS).forEach(providerId => {
        const key = getStoredApiKey(providerId);
        if (key) keys[providerId] = key;
      });
      setApiKeys(keys);

      // Load default provider
      const defaultSelection = getDefaultProvider();
      if (defaultSelection) {
        setDefaultProvider(defaultSelection.providerId);
      }

      // Load theme preference
      const savedTheme = localStorage.getItem('c3chat-theme') as 'light' | 'dark' | 'auto' || 'auto';
      setTheme(savedTheme);
    }
  }, [isOpen]);

  const handleApiKeyChange = (providerId: string, value: string) => {
    setApiKeys(prev => ({ ...prev, [providerId]: value }));
  };

  const handleApiKeySave = (providerId: string) => {
    const key = apiKeys[providerId]?.trim();
    if (key) {
      setStoredApiKey(providerId, key);
      toast.success(`API key saved for ${AI_PROVIDERS[providerId].name}`);
    } else {
      removeStoredApiKey(providerId);
      toast.info(`API key removed for ${AI_PROVIDERS[providerId].name}`);
    }
  };

  const toggleApiKeyVisibility = (providerId: string) => {
    setShowApiKey(prev => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  const handleDefaultProviderChange = (providerId: string) => {
    setDefaultProvider(providerId);
    setPreferredProvider(providerId);
    
    // Set default model for this provider
    const provider = AI_PROVIDERS[providerId];
    const defaultModel = provider.models.find(m => m.recommended)?.id || provider.models[0]?.id;
    if (defaultModel) {
      setPreferredModel(providerId, defaultModel);
    }
    
    toast.success(`Default provider set to ${provider.name}`);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'auto') => {
    setTheme(newTheme);
    localStorage.setItem('c3chat-theme', newTheme);
    
    // Apply theme immediately
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (newTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // Auto theme
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    
    toast.success(`Theme changed to ${newTheme}`);
  };

  const clearAllData = () => {
    if (confirm('Are you sure you want to clear all stored data? This will remove all API keys and preferences.')) {
      // Clear API keys
      Object.keys(AI_PROVIDERS).forEach(providerId => {
        removeStoredApiKey(providerId);
      });
      
      // Clear preferences
      localStorage.removeItem('c3chat-preferred-provider');
      localStorage.removeItem('c3chat-preferred-models');
      localStorage.removeItem('c3chat-theme');
      
      setApiKeys({});
      setDefaultProvider('');
      setTheme('auto');
      
      toast.success('All data cleared');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Configure your AI providers and preferences</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-8rem)] overflow-y-auto">
          <div className="p-6 space-y-8">
            
            {/* Theme Settings */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appearance</h3>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Theme
                </label>
                <div className="flex space-x-3">
                  {(['light', 'dark', 'auto'] as const).map((themeOption) => (
                    <button
                      key={themeOption}
                      onClick={() => handleThemeChange(themeOption)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        theme === themeOption
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Default Provider */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Default AI Provider</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.values(AI_PROVIDERS).map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => handleDefaultProviderChange(provider.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      defaultProvider === provider.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{provider.name}</h4>
                      {provider.featured && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                          Featured
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{provider.description}</p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                      {hasValidApiKey(provider.id) && (
                        <span className="text-green-600 dark:text-green-400">✓ Configured</span>
                      )}
                      {provider.freeTier && <span>Free tier</span>}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* API Keys */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">API Keys</h3>
              <div className="space-y-4">
                {Object.values(AI_PROVIDERS).map((provider) => (
                  <div key={provider.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">{provider.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{provider.description}</p>
                        {provider.apiKeysUrl && (
                          <a
                            href={provider.apiKeysUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Get API key →
                          </a>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {hasValidApiKey(provider.id) && (
                          <span className="text-green-600 dark:text-green-400 text-sm">✓ Configured</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <div className="flex-1 relative">
                        <input
                          type={showApiKey[provider.id] ? 'text' : 'password'}
                          value={apiKeys[provider.id] || ''}
                          onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                          placeholder="Enter API key..."
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => toggleApiKeyVisibility(provider.id)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {showApiKey[provider.id] ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                      <button
                        onClick={() => handleApiKeySave(provider.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Danger Zone */}
            <section>
              <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">Danger Zone</h3>
              <div className="p-4 border border-red-200 dark:border-red-800 rounded-xl bg-red-50 dark:bg-red-900/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-red-800 dark:text-red-300">Clear All Data</h4>
                    <p className="text-sm text-red-600 dark:text-red-400">Remove all API keys and preferences</p>
                  </div>
                  <button
                    onClick={clearAllData}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
