// Enhanced AI Provider Configuration with better UX
export interface AIProvider {
  id: string;
  name: string;
  description: string;
  baseURL: string;
  models: AIModel[];
  requiresApiKey: boolean;
  supportsStreaming: boolean;
  supportsTools?: boolean;
  supportsImages?: boolean;
  supportsWebSearch?: boolean;
  websiteUrl?: string;
  apiKeysUrl?: string;
  freeTier?: boolean;
  popular?: boolean;
  featured?: boolean;
}

export interface AIModel {
  id: string;
  name: string;
  contextLength: number;
  description?: string;
  pricing?: {
    inputPer1M: number;
    outputPer1M: number;
  };
  strengths?: string[];
  recommended?: boolean;
  maxOutputTokens?: number;
}

// Supported AI Providers - NO DEFAULT SELECTION
export const AI_PROVIDERS: Record<string, AIProvider> = {
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access 100+ models from multiple providers with unified pricing",
    baseURL: "https://openrouter.ai/api/v1",
    requiresApiKey: true,
    supportsStreaming: true,
    supportsTools: true,
    supportsImages: true,
    supportsWebSearch: false,
    websiteUrl: "https://openrouter.ai",
    apiKeysUrl: "https://openrouter.ai/keys",
    freeTier: true,
    popular: true,
    featured: true,
    models: [
      {
        id: "auto",
        name: "Auto (Best for prompt)",
        contextLength: 128000,
        description: "Automatically selects the best model for your prompt",
        recommended: true,
        strengths: ["Smart routing", "Cost-effective", "Reliable"],
      },
      {
        id: "openai/gpt-4o",
        name: "GPT-4o",
        contextLength: 128000,
        description: "OpenAI's most capable model with vision",
        pricing: { inputPer1M: 2.5, outputPer1M: 10 },
        strengths: ["Reasoning", "Vision", "Tool use"],
      },
      {
        id: "openai/gpt-4o-mini",
        name: "GPT-4o Mini",
        contextLength: 128000,
        description: "Fast and affordable GPT-4 level model",
        pricing: { inputPer1M: 0.15, outputPer1M: 0.6 },
        strengths: ["Speed", "Cost-effective", "General tasks"],
        recommended: true,
      },
      {
        id: "anthropic/claude-4-opus",
        name: "Claude 4 Opus",
        contextLength: 200000,
        description: "Anthropic's most powerful model",
        pricing: { inputPer1M: 15, outputPer1M: 75 },
        strengths: ["Creative writing", "Complex reasoning", "Analysis"],
      },
      {
        id: "google/gemini-2.0-pro",
        name: "Gemini 2.0 Pro",
        contextLength: 1000000,
        description: "Google's multimodal model with huge context",
        pricing: { inputPer1M: 1.25, outputPer1M: 5 },
        strengths: ["Long context", "Multimodal", "Code generation"],
      },
      {
        id: "meta-llama/llama-3.3-70b-instruct",
        name: "Llama 3.3 70B",
        contextLength: 128000,
        description: "Meta's open-source powerhouse",
        pricing: { inputPer1M: 0.5, outputPer1M: 0.75 },
        strengths: ["Open source", "Coding", "Math"],
      },
      {
        id: "deepseek/deepseek-r1",
        name: "DeepSeek R1",
        contextLength: 128000,
        description: "Cutting-edge reasoning model",
        pricing: { inputPer1M: 0.55, outputPer1M: 2.19 },
        strengths: ["Reasoning", "Problem solving", "Research"],
      },
    ],
  },

  openai: {
    id: "openai",
    name: "OpenAI",
    description: "The creators of ChatGPT and GPT models",
    baseURL: "https://api.openai.com/v1",
    requiresApiKey: true,
    supportsStreaming: true,
    supportsTools: true,
    supportsImages: true,
    supportsWebSearch: false,
    websiteUrl: "https://openai.com",
    apiKeysUrl: "https://platform.openai.com/api-keys",
    popular: true,
    models: [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        contextLength: 128000,
        description: "Most capable model, best for complex tasks",
        pricing: { inputPer1M: 2.5, outputPer1M: 10 },
        strengths: ["Reasoning", "Vision", "Complex tasks"],
        maxOutputTokens: 16384,
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        contextLength: 128000,
        description: "Fast and affordable for most tasks",
        pricing: { inputPer1M: 0.15, outputPer1M: 0.6 },
        strengths: ["Speed", "Cost-effective", "General use"],
        recommended: true,
        maxOutputTokens: 16384,
      },
      {
        id: "gpt-3.5-turbo",
        name: "GPT-3.5 Turbo",
        contextLength: 16385,
        description: "Fast and reliable for simple tasks",
        pricing: { inputPer1M: 0.5, outputPer1M: 1.5 },
        strengths: ["Speed", "Simple tasks", "Legacy support"],
        maxOutputTokens: 4096,
      },
    ],
  },
  
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    description: "AI safety focused models with excellent reasoning",
    baseURL: "https://api.anthropic.com/v1",
    requiresApiKey: true,
    supportsStreaming: true,
    supportsTools: true,
    supportsImages: true,
    supportsWebSearch: false,
    websiteUrl: "https://anthropic.com",
    apiKeysUrl: "https://console.anthropic.com/account/keys",
    popular: true,
    models: [
      {
        id: "claude-4-opus-20250514",
        name: "Claude 4 Opus",
        contextLength: 200000,
        description: "Most powerful Claude model for complex tasks",
        pricing: { inputPer1M: 15, outputPer1M: 75 },
        strengths: ["Creative writing", "Complex reasoning", "Research"],
        maxOutputTokens: 8192,
      },
      {
        id: "claude-4-sonnet-20250514",
        name: "Claude 4 Sonnet", 
        contextLength: 200000,
        description: "Balanced performance and cost",
        pricing: { inputPer1M: 3, outputPer1M: 15 },
        strengths: ["Balanced", "Analysis", "Writing"],
        recommended: true,
        maxOutputTokens: 8192,
      },
      {
        id: "claude-3-haiku-20240307",
        name: "Claude 3 Haiku",
        contextLength: 200000,
        description: "Fastest Claude model",
        pricing: { inputPer1M: 0.25, outputPer1M: 1.25 },
        strengths: ["Speed", "Simple tasks", "Cost-effective"],
        maxOutputTokens: 4096,
      },
    ],
  },

  google: {
    id: "google",
    name: "Google Gemini",
    description: "Google's multimodal AI with massive context windows",
    baseURL: "https://generativelanguage.googleapis.com/v1",
    requiresApiKey: true,
    supportsStreaming: true,
    supportsTools: true,
    supportsImages: true,
    supportsWebSearch: false,
    websiteUrl: "https://ai.google.dev",
    apiKeysUrl: "https://makersuite.google.com/app/apikey",
    freeTier: true,
    models: [
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        contextLength: 1000000,
        description: "Multimodal model with 1M context window",
        pricing: { inputPer1M: 1.25, outputPer1M: 5 },
        strengths: ["Long context", "Multimodal", "Analysis"],
        maxOutputTokens: 8192,
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        contextLength: 1000000,
        description: "Fast multimodal model with huge context",
        pricing: { inputPer1M: 0.075, outputPer1M: 0.3 },
        strengths: ["Speed", "Long context", "Multimodal"],
        recommended: true,
        maxOutputTokens: 8192,
      },
    ],
  },
};

// Web Search Providers
export const WEB_SEARCH_PROVIDERS = {
  brave: {
    name: "Brave Search",
    description: "Privacy-focused search with API access",
    websiteUrl: "https://search.brave.com",
    apiUrl: "https://brave.com/search/api",
    signupUrl: "https://api.search.brave.com",
    pricing: "Free tier available, then $3/1000 queries",
    features: ["Privacy-focused", "No tracking", "Independent index"],
  },
  tavily: {
    name: "Tavily",
    description: "AI-optimized search API for developers",
    websiteUrl: "https://tavily.com",
    apiUrl: "https://docs.tavily.com",
    signupUrl: "https://app.tavily.com",
    pricing: "1000 free searches/month, then $0.001/search",
    features: ["AI-optimized", "Real-time", "Developer-friendly"],
  },
  serper: {
    name: "Serper",
    description: "Google Search API with clean results",
    websiteUrl: "https://serper.dev",
    apiUrl: "https://serper.dev/api",
    signupUrl: "https://serper.dev/signup",
    pricing: "2500 free searches, then $50/100k searches",
    features: ["Google results", "Fast", "Reliable"],
  },
};

// Storage keys for API keys and preferences
export const API_KEY_STORAGE_PREFIX = "c3chat_api_key_";
export const PROVIDER_PREFERENCE_KEY = "c3chat_preferred_provider";
export const MODEL_PREFERENCE_KEY = "c3chat_preferred_model";

// Helper functions
export function getStoredApiKey(providerId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(API_KEY_STORAGE_PREFIX + providerId);
}

export function setStoredApiKey(providerId: string, apiKey: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(API_KEY_STORAGE_PREFIX + providerId, apiKey);
}

export function removeStoredApiKey(providerId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(API_KEY_STORAGE_PREFIX + providerId);
}

// Check if provider has valid API key
export function hasValidApiKey(providerId: string): boolean {
  const key = getStoredApiKey(providerId);
  return !!key && key.length > 0;
}

// Get/Set provider preferences
export function getPreferredProvider(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PROVIDER_PREFERENCE_KEY);
}

export function setPreferredProvider(providerId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROVIDER_PREFERENCE_KEY, providerId);
}

export function getPreferredModel(providerId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`${MODEL_PREFERENCE_KEY}_${providerId}`);
}

export function setPreferredModel(providerId: string, modelId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${MODEL_PREFERENCE_KEY}_${providerId}`, modelId);
}

// Smart provider selection logic
export function getDefaultProvider(): { providerId: string; modelId: string } | null {
  // First check user preference
  const preferredProvider = getPreferredProvider();
  if (preferredProvider && AI_PROVIDERS[preferredProvider]) {
    const provider = AI_PROVIDERS[preferredProvider];
    
    // Check if user has API key for preferred provider
    if (!provider.requiresApiKey || hasValidApiKey(preferredProvider)) {
      const preferredModel = getPreferredModel(preferredProvider);
      const defaultModel = preferredModel || 
        provider.models.find(m => m.recommended)?.id || 
        provider.models[0]?.id;
      
      if (defaultModel) {
        return { providerId: preferredProvider, modelId: defaultModel };
      }
    }
  }

  // Look for providers with existing API keys
  for (const provider of Object.values(AI_PROVIDERS)) {
    if (provider.requiresApiKey && hasValidApiKey(provider.id)) {
      const defaultModel = provider.models.find(m => m.recommended)?.id || provider.models[0]?.id;
      if (defaultModel) {
        return { providerId: provider.id, modelId: defaultModel };
      }
    }
  }

  // No provider with API key found - don't auto-select
  return null;
}

// Get recommended models across all providers
export function getRecommendedModels(): Array<{ provider: AIProvider; model: AIModel }> {
  const recommendations: Array<{ provider: AIProvider; model: AIModel }> = [];
  
  for (const provider of Object.values(AI_PROVIDERS)) {
    for (const model of provider.models) {
      if (model.recommended) {
        recommendations.push({ provider, model });
      }
    }
  }
  
  return recommendations.sort((a, b) => {
    // Sort by provider popularity and model pricing
    if (a.provider.featured && !b.provider.featured) return -1;
    if (!a.provider.featured && b.provider.featured) return 1;
    if (a.provider.popular && !b.provider.popular) return -1;
    if (!a.provider.popular && b.provider.popular) return 1;
    
    const aPrice = a.model.pricing?.inputPer1M || 0;
    const bPrice = b.model.pricing?.inputPer1M || 0;
    return aPrice - bPrice;
  });
}

// Provider categorization
export function getProvidersByCategory() {
  const featured = Object.values(AI_PROVIDERS).filter(p => p.featured);
  const popular = Object.values(AI_PROVIDERS).filter(p => p.popular && !p.featured);
  const others = Object.values(AI_PROVIDERS).filter(p => !p.popular && !p.featured);
  
  return { featured, popular, others };
}

// Model comparison helpers
export function compareModels(modelA: AIModel, modelB: AIModel) {
  return {
    contextLength: modelA.contextLength - modelB.contextLength,
    pricing: (modelA.pricing?.inputPer1M || 0) - (modelB.pricing?.inputPer1M || 0),
    hasStrengths: (modelA.strengths?.length || 0) - (modelB.strengths?.length || 0),
  };
}

// Format pricing for display
export function formatPricing(pricing?: { inputPer1M: number; outputPer1M: number }): string {
  if (!pricing) return "Pricing varies";
  return `$${pricing.inputPer1M}/1M in • $${pricing.outputPer1M}/1M out`;
}

// Format context length for display
export function formatContextLength(length: number): string {
  if (length >= 1000000) {
    return `${(length / 1000000).toFixed(1)}M tokens`;
  } else if (length >= 1000) {
    return `${(length / 1000).toFixed(0)}K tokens`;
  } else {
    return `${length} tokens`;
  }
}
