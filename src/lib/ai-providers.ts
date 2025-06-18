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
  supportsMediaGeneration?: boolean; // For image/video generation
  websiteUrl?: string;
  apiKeysUrl?: string;
  freeTier?: boolean;
  popular?: boolean;
  featured?: boolean;
  logo?: string; // SVG logo component
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
  type?: 'text' | 'image' | 'video'; // Media generation type
  capabilities?: string[]; // Specific capabilities like "text-to-image", "text-to-video"
}

// Company Logo identifiers for simple string-based rendering
export const COMPANY_LOGOS = {
  openai: 'openai-logo',
  anthropic: 'anthropic-logo', 
  google: 'google-logo'
} as const;

// Supported AI Providers - NO DEFAULT SELECTION
export const AI_PROVIDERS: Record<string, AIProvider> = {
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access 200+ models from multiple providers with unified pricing",
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
    logo: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
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
        id: "openai/gpt-5",
        name: "GPT-5",
        contextLength: 200000,
        description: "OpenAI's newest flagship model with advanced reasoning",
        pricing: { inputPer1M: 10, outputPer1M: 40 },
        strengths: ["Advanced reasoning", "Vision", "Tool use", "Latest knowledge"],
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
        description: "Anthropic's most powerful model with extended thinking",
        pricing: { inputPer1M: 15, outputPer1M: 75 },
        strengths: ["Creative writing", "Complex reasoning", "Coding"],
      },
      {
        id: "anthropic/claude-4-sonnet",
        name: "Claude 4 Sonnet",
        contextLength: 200000,
        description: "Balanced Claude 4 model for everyday use",
        pricing: { inputPer1M: 3, outputPer1M: 15 },
        strengths: ["Balanced performance", "Analysis", "Writing"],
        recommended: true,
      },
      {
        id: "google/gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        contextLength: 1000000,
        description: "Google's latest multimodal model with huge context",
        pricing: { inputPer1M: 1.25, outputPer1M: 5 },
        strengths: ["Long context", "Multimodal", "Code generation"],
      },
      // FREE MODELS
      {
        id: "meta-llama/llama-3.3-70b-instruct:free",
        name: "Llama 3.3 70B (Free)",
        contextLength: 128000,
        description: "Meta's latest Llama model - FREE with rate limits",
        pricing: { inputPer1M: 0, outputPer1M: 0 },
        strengths: ["Free", "General purpose", "Instruction following"],
        recommended: true,
      },
      {
        id: "google/gemini-2.0-flash-exp:free",
        name: "Gemini 2.0 Flash (Free)",
        contextLength: 1000000,
        description: "Google's experimental flash model - FREE",
        pricing: { inputPer1M: 0, outputPer1M: 0 },
        strengths: ["Free", "Fast", "Long context"],
      },
      {
        id: "deepseek/deepseek-chat-v3-0324:free",
        name: "DeepSeek Chat V3 (Free)",
        contextLength: 64000,
        description: "Excellent for coding tasks - FREE",
        pricing: { inputPer1M: 0, outputPer1M: 0 },
        strengths: ["Free", "Coding", "Reasoning"],
        recommended: true,
      },
      {
        id: "deepseek/deepseek-r1:free",
        name: "DeepSeek R1 (Free)",
        contextLength: 64000,
        description: "DeepSeek's reasoning model - FREE",
        pricing: { inputPer1M: 0, outputPer1M: 0 },
        strengths: ["Free", "Reasoning", "Problem solving"],
      },
      {
        id: "qwen/qwq-32b:free",
        name: "QWQ 32B (Free)",
        contextLength: 32768,
        description: "Qwen's reasoning model - FREE",
        pricing: { inputPer1M: 0, outputPer1M: 0 },
        strengths: ["Free", "Reasoning", "Math"],
      },
      {
        id: "meta-llama/llama-3.1-8b-instruct:free",
        name: "Llama 3.1 8B (Free)",
        contextLength: 128000,
        description: "Smaller Llama model - FREE, faster responses",
        pricing: { inputPer1M: 0, outputPer1M: 0 },
        strengths: ["Free", "Fast", "Basic tasks"],
      },
      {
        id: "google/gemma-3-27b-it:free",
        name: "Gemma 3 27B (Free)",
        contextLength: 8192,
        description: "Google's Gemma model - FREE",
        pricing: { inputPer1M: 0, outputPer1M: 0 },
        strengths: ["Free", "Efficient", "General purpose"],
      },
      {
        id: "nvidia/llama-3.1-nemotron-ultra-253b-v1:free",
        name: "Nemotron Ultra 253B (Free)",
        contextLength: 128000,
        description: "NVIDIA's massive model - FREE with limits",
        pricing: { inputPer1M: 0, outputPer1M: 0 },
        strengths: ["Free", "Large scale", "Complex tasks"],
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
    logo: COMPANY_LOGOS.openai,
    models: [
      {
        id: "gpt-4.1",
        name: "GPT-4.1",
        contextLength: 1000000,
        description: "Latest model with 1M context, excellent for coding",
        pricing: { inputPer1M: 2.5, outputPer1M: 10 },
        strengths: ["Advanced reasoning", "Vision", "Complex tasks", "Coding"],
        recommended: true,
        maxOutputTokens: 32768,
      },
      {
        id: "gpt-4.1-mini",
        name: "GPT-4.1 Mini",
        contextLength: 1000000,
        description: "Smaller variant, 83% cheaper than GPT-4o",
        pricing: { inputPer1M: 0.15, outputPer1M: 0.6 },
        strengths: ["Speed", "Cost-effective", "General use"],
        recommended: true,
        maxOutputTokens: 16384,
      },
      {
        id: "gpt-4.1-nano",
        name: "GPT-4.1 Nano",
        contextLength: 128000,
        description: "Fastest and cheapest, good for classification",
        pricing: { inputPer1M: 0.075, outputPer1M: 0.3 },
        strengths: ["Speed", "Classification", "Simple tasks"],
        maxOutputTokens: 8192,
      },
      {
        id: "gpt-4o",
        name: "GPT-4o",
        contextLength: 128000,
        description: "Previous generation, still available",
        pricing: { inputPer1M: 2.5, outputPer1M: 10 },
        strengths: ["Reasoning", "Vision", "Complex tasks"],
        maxOutputTokens: 16384,
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        contextLength: 128000,
        description: "Previous generation mini model",
        pricing: { inputPer1M: 0.15, outputPer1M: 0.6 },
        strengths: ["Speed", "Cost-effective", "General use"],
        maxOutputTokens: 16384,
      },
      {
        id: "o4-mini",
        name: "o4 Mini",
        contextLength: 200000,
        description: "Reasoning model with excellent performance",
        pricing: { inputPer1M: 3, outputPer1M: 12 },
        strengths: ["Reasoning", "Math", "Science", "Problem solving"],
        maxOutputTokens: 16384,
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
    logo: COMPANY_LOGOS.anthropic,
    models: [
      {
        id: "claude-opus-4-20250514",
        name: "Claude Opus 4",
        contextLength: 200000,
        description: "Most powerful Claude model (May 2025)",
        pricing: { inputPer1M: 15, outputPer1M: 75 },
        strengths: ["Creative writing", "Complex reasoning", "Research", "Coding"],
        recommended: true,
        maxOutputTokens: 32000,
      },
      {
        id: "claude-sonnet-4-20250514", 
        name: "Claude Sonnet 4",
        contextLength: 200000,
        description: "Balanced performance and cost (May 2025)",
        pricing: { inputPer1M: 3, outputPer1M: 15 },
        strengths: ["Balanced", "Analysis", "Writing", "Coding"],
        recommended: true,
        maxOutputTokens: 32000,
      },
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        contextLength: 200000,
        description: "128K output support with beta header (Feb 2025)",
        pricing: { inputPer1M: 3, outputPer1M: 15 },
        strengths: ["Long output", "Analysis", "Writing"],
        maxOutputTokens: 128000,
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        contextLength: 200000,
        description: "Previous generation, still powerful",
        pricing: { inputPer1M: 3, outputPer1M: 15 },
        strengths: ["Balanced", "Analysis", "Writing"],
        maxOutputTokens: 8192,
      },
      {
        id: "claude-3-5-haiku-20241022",
        name: "Claude 3.5 Haiku",
        contextLength: 200000,
        description: "Fast model with vision capabilities",
        pricing: { inputPer1M: 0.25, outputPer1M: 1.25 },
        strengths: ["Speed", "Vision", "Cost-effective"],
        maxOutputTokens: 8192,
      },
    ],
  },

  google: {
    id: "google",
    name: "Google Gemini",
    description: "Google's multimodal AI with massive context windows and media generation",
    baseURL: "https://generativelanguage.googleapis.com/v1",
    requiresApiKey: true,
    supportsStreaming: true,
    supportsTools: true,
    supportsImages: true,
    supportsWebSearch: false,
    supportsMediaGeneration: true, // New flag for media generation
    websiteUrl: "https://ai.google.dev",
    apiKeysUrl: "https://makersuite.google.com/app/apikey",
    freeTier: true,
    logo: COMPANY_LOGOS.google,
    models: [
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        contextLength: 1048576,
        description: "Our most powerful thinking model with maximum response accuracy and state-of-the-art performance",
        pricing: { inputPer1M: 1.25, outputPer1M: 10.0 }, // Prompts <= 200k tokens
        strengths: ["Complex reasoning", "Thinking", "Multimodal", "Advanced coding"],
        recommended: true,
        maxOutputTokens: 65536,
      },
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        contextLength: 1048576,
        description: "Our best model in terms of price-performance, offering well-rounded capabilities",
        pricing: { inputPer1M: 0.30, outputPer1M: 2.50 },
        strengths: ["Adaptive thinking", "Cost efficiency", "Low latency", "High volume"],
        recommended: true,
        maxOutputTokens: 65536,
      },
      {
        id: "gemini-2.5-flash-lite-preview-06-17",
        name: "Gemini 2.5 Flash-Lite Preview",
        contextLength: 1000000,
        description: "A Gemini 2.5 Flash model optimized for cost efficiency and low latency",
        pricing: { inputPer1M: 0.10, outputPer1M: 0.40 },
        strengths: ["Most cost-efficient", "High throughput", "Real-time", "Low latency"],
        recommended: true,
        maxOutputTokens: 64000,
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        contextLength: 1048576,
        description: "Next generation features, speed, and realtime streaming",
        pricing: { inputPer1M: 0.10, outputPer1M: 0.40 },
        strengths: ["Superior speed", "Native tool use", "Realtime", "1M context"],
        recommended: true,
        maxOutputTokens: 8192,
      },
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        contextLength: 2097152,
        description: "Mid-size multimodal model optimized for wide-range reasoning tasks with 2M context",
        pricing: { inputPer1M: 0.30, outputPer1M: 1.20 },
        strengths: ["2M context", "Complex reasoning", "Multimodal", "2hr video"],
        recommended: false,
        maxOutputTokens: 8192,
      },
      {
        id: "imagen-3.0-generate-002",
        name: "Imagen 3",
        contextLength: 1024,
        description: "Our highest quality text-to-image model with better detail and lighting (paid tier only)",
        pricing: { inputPer1M: 0.03, outputPer1M: 0.03 }, // $0.03 per image
        strengths: ["Better detail", "Richer lighting", "Fewer artifacts", "High quality"],
        recommended: false,
        type: "image",
        capabilities: ["text-to-image"],
        maxOutputTokens: 0,
      },
      {
        id: "veo-2.0-generate-001",
        name: "Veo 2",
        contextLength: 2048,
        description: "High quality text- and image-to-video model capturing artistic nuance (paid tier only)",
        pricing: { inputPer1M: 0.35, outputPer1M: 0.35 }, // $0.35 per second
        strengths: ["Detailed videos", "Artistic nuance", "Image-to-video", "High quality"],
        recommended: false,
        type: "video",
        capabilities: ["text-to-video", "image-to-video"],
        maxOutputTokens: 0,
      },
      {
        id: "gemini-1.5-flash",
        name: "Gemini 1.5 Flash",
        contextLength: 1048576,
        description: "Fast and versatile multimodal model for scaling across diverse tasks",
        pricing: { inputPer1M: 0.075, outputPer1M: 0.30 },
        strengths: ["Fast", "Versatile", "1M context", "9.5hr audio"],
        recommended: false,
        maxOutputTokens: 8192,
      },
      {
        id: "gemini-1.5-flash-8b",
        name: "Gemini 1.5 Flash-8B",
        contextLength: 1048576,
        description: "Small model designed for high volume and lower intelligence tasks",
        pricing: { inputPer1M: 0.0375, outputPer1M: 0.15 },
        strengths: ["High volume", "Cost-effective", "Basic tasks", "1M context"],
        recommended: false,
        maxOutputTokens: 8192,
      },
      {
        id: "gemini-2.0-flash-preview-image-generation",
        name: "Gemini 2.0 Flash Image Gen",
        contextLength: 32000,
        description: "Multimodal model with native image generation and editing capabilities",
        pricing: { inputPer1M: 0.10, outputPer1M: 0.40 },
        strengths: ["Text + images", "Image generation", "Image editing", "Conversational"],
        recommended: false,
        capabilities: ["text-generation", "text-to-image", "image-editing", "multimodal"],
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

import { secureStorage } from './crypto-utils';

// Storage keys for API keys and preferences
export const API_KEY_STORAGE_PREFIX = "c3chat_api_key_";
export const PROVIDER_PREFERENCE_KEY = "c3chat_preferred_provider";
export const MODEL_PREFERENCE_KEY = "c3chat_preferred_model";

// Helper functions with encryption
export async function getStoredApiKey(providerId: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    return await secureStorage.getItem(API_KEY_STORAGE_PREFIX + providerId);
  } catch (error) {
    console.error('Failed to retrieve API key:', error);
    return null;
  }
}

export async function setStoredApiKey(providerId: string, apiKey: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await secureStorage.setItem(API_KEY_STORAGE_PREFIX + providerId, apiKey);
  } catch (error) {
    console.error('Failed to store API key:', error);
    throw error;
  }
}

export function removeStoredApiKey(providerId: string): void {
  if (typeof window === "undefined") return;
  secureStorage.removeItem(API_KEY_STORAGE_PREFIX + providerId);
}

// Check if provider has valid API key (now async)
export async function hasValidApiKey(providerId: string): Promise<boolean> {
  const key = await getStoredApiKey(providerId);
  return !!key && key.length > 0;
}

// Synchronous wrapper for backwards compatibility
export function getStoredApiKeySync(providerId: string): string | null {
  if (typeof window === "undefined") return null;
  // Try to get the encrypted value first
  const encryptedFlag = localStorage.getItem(API_KEY_STORAGE_PREFIX + providerId + '_encrypted_flag');
  if (encryptedFlag === 'true') {
    // If encrypted, we can't decrypt synchronously
    console.warn('API key is encrypted, use getStoredApiKey() instead');
    return null;
  }
  // Fall back to plain text
  return localStorage.getItem(API_KEY_STORAGE_PREFIX + providerId);
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

// Smart provider selection logic (async version)
export async function getDefaultProvider(): Promise<{ providerId: string; modelId: string } | null> {
  // First check user preference
  const preferredProvider = getPreferredProvider();
  if (preferredProvider && AI_PROVIDERS[preferredProvider]) {
    const provider = AI_PROVIDERS[preferredProvider];
    
    // Check if user has API key for preferred provider
    if (!provider.requiresApiKey || await hasValidApiKey(preferredProvider)) {
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
    if (provider.requiresApiKey && await hasValidApiKey(provider.id)) {
      const defaultModel = provider.models.find(m => m.recommended)?.id || provider.models[0]?.id;
      if (defaultModel) {
        return { providerId: provider.id, modelId: defaultModel };
      }
    }
  }

  // No provider with API key found - don't auto-select
  return null;
}

// Synchronous version for backwards compatibility (less secure)
export function getDefaultProviderSync(): { providerId: string; modelId: string } | null {
  // First check user preference
  const preferredProvider = getPreferredProvider();
  if (preferredProvider && AI_PROVIDERS[preferredProvider]) {
    const provider = AI_PROVIDERS[preferredProvider];
    
    // For sync version, we can't check encrypted keys
    if (!provider.requiresApiKey) {
      const preferredModel = getPreferredModel(preferredProvider);
      const defaultModel = preferredModel || 
        provider.models.find(m => m.recommended)?.id || 
        provider.models[0]?.id;
      
      if (defaultModel) {
        return { providerId: preferredProvider, modelId: defaultModel };
      }
    }
  }

  // No provider found - don't auto-select
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

// Migrate existing plain text API keys to encrypted storage
export async function migrateApiKeys(): Promise<void> {
  if (typeof window === "undefined") return;
  
  try {
    // Migrate all provider API keys
    for (const provider of Object.values(AI_PROVIDERS)) {
      const key = API_KEY_STORAGE_PREFIX + provider.id;
      await secureStorage.migrateKey(key);
      
      // Also check for the old format used in Settings component
      const oldKey = `apiKey_${provider.id}`;
      const oldValue = localStorage.getItem(oldKey);
      if (oldValue) {
        await setStoredApiKey(provider.id, oldValue);
        localStorage.removeItem(oldKey);
      }
    }
  } catch (error) {
    console.error('Failed to migrate API keys:', error);
  }
}

// Provider categorization
export function getProvidersByCategory() {
  const providers = Object.values(AI_PROVIDERS);
  return {
    featured: providers.filter(p => p.featured),
    popular: providers.filter(p => p.popular && !p.featured),
    others: providers.filter(p => !p.popular && !p.featured),
  };
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
  if (pricing.inputPer1M === 0 && pricing.outputPer1M === 0) {
    return "🎉 FREE (rate limited)";
  }
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
