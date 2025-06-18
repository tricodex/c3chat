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
  google: 'google-logo',
  meta: 'meta-logo',
  mistral: 'mistral-logo',
  deepseek: 'deepseek-logo',
  xai: 'xai-logo',
  perplexity: 'perplexity-logo',
  cohere: 'cohere-logo',
  reka: 'reka-logo'
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
      {
        id: "meta-llama/llama-4-maverick",
        name: "Llama 4 Maverick",
        contextLength: 1000000,
        description: "Meta's latest open-source powerhouse",
        pricing: { inputPer1M: 0.5, outputPer1M: 0.75 },
        strengths: ["Open source", "Coding", "Math", "Long context"],
      },
      {
        id: "deepseek/deepseek-r1",
        name: "DeepSeek R1",
        contextLength: 128000,
        description: "Advanced reasoning model with thinking capability",
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
        contextLength: 1000000,
        description: "Thinking model with advanced reasoning",
        pricing: { inputPer1M: 1.25, outputPer1M: 5 },
        strengths: ["Thinking", "Long context", "Multimodal", "Reasoning"],
        recommended: true,
        maxOutputTokens: 8192,
      },
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        contextLength: 1000000,
        description: "Fast thinking model with reasoning capabilities",
        pricing: { inputPer1M: 0.075, outputPer1M: 0.3 },
        strengths: ["Thinking", "Speed", "Long context", "Multimodal"],
        recommended: true,
        maxOutputTokens: 8192,
      },
      {
        id: "gemini-2.5-flash-lite-preview-06-17",
        name: "Gemini 2.5 Flash Lite Preview",
        contextLength: 1000000,
        description: "Cost-optimized model with optional thinking mode (Preview)",
        pricing: { inputPer1M: 0.10, outputPer1M: 0.40 },
        strengths: ["Cost", "Speed", "Simple tasks", "High volume"],
        recommended: true,
        maxOutputTokens: 8192,
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        contextLength: 1000000,
        description: "Fast multimodal model - WORKING",
        pricing: { inputPer1M: 0.075, outputPer1M: 0.3 },
        strengths: ["Speed", "Long context", "Multimodal"],
        recommended: true,
        maxOutputTokens: 8192,
      },
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        contextLength: 2000000,
        description: "Previous generation with 2M context",
        pricing: { inputPer1M: 1.25, outputPer1M: 5 },
        strengths: ["Long context", "Multimodal", "Analysis"],
        recommended: false,
        maxOutputTokens: 8192,
      },
      {
        id: "imagen-3",
        name: "Imagen 3",
        contextLength: 1024,
        description: "Google's latest text-to-image generation model",
        pricing: { inputPer1M: 0.02, outputPer1M: 0.02 }, // Per image pricing
        strengths: ["High quality", "Photorealistic", "Artistic styles"],
        recommended: true,
        type: "image",
        capabilities: ["text-to-image", "image-editing"],
        maxOutputTokens: 0,
      },
      {
        id: "imagen-2",
        name: "Imagen 2",
        contextLength: 1024,
        description: "Previous generation image model",
        pricing: { inputPer1M: 0.02, outputPer1M: 0.02 },
        strengths: ["Quality", "Speed", "Reliability"],
        type: "image",
        capabilities: ["text-to-image"],
        maxOutputTokens: 0,
      },
      {
        id: "veo-2",
        name: "Veo 2",
        contextLength: 2048,
        description: "Google's advanced text-to-video generation model",
        pricing: { inputPer1M: 0.05, outputPer1M: 0.05 }, // Per video pricing
        strengths: ["High resolution", "Smooth motion", "Long videos"],
        recommended: true,
        type: "video",
        capabilities: ["text-to-video"],
        maxOutputTokens: 0,
      },
    ],
  },

  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    description: "Advanced reasoning models with excellent performance",
    baseURL: "https://api.deepseek.com/v1",
    requiresApiKey: true,
    supportsStreaming: true,
    supportsTools: true,
    supportsImages: false,
    supportsWebSearch: false,
    websiteUrl: "https://deepseek.com",
    apiKeysUrl: "https://platform.deepseek.com/api_keys",
    popular: true,
    logo: COMPANY_LOGOS.deepseek,
    models: [
      {
        id: "deepseek-r1",
        name: "DeepSeek R1",
        contextLength: 128000,
        description: "Advanced reasoning model with thinking capability",
        pricing: { inputPer1M: 0.55, outputPer1M: 2.19 },
        strengths: ["Reasoning", "Problem solving", "Research"],
        recommended: true,
        maxOutputTokens: 8192,
      },
      {
        id: "deepseek-v3",
        name: "DeepSeek V3",
        contextLength: 128000,
        description: "Powerful general-purpose model",
        pricing: { inputPer1M: 0.27, outputPer1M: 1.1 },
        strengths: ["General tasks", "Coding", "Analysis"],
        maxOutputTokens: 8192,
      },
    ],
  },

  xai: {
    id: "xai",
    name: "xAI",
    description: "Elon Musk's AI company with Grok models",
    baseURL: "https://api.x.ai/v1",
    requiresApiKey: true,
    supportsStreaming: true,
    supportsTools: true,
    supportsImages: true,
    supportsWebSearch: true,
    websiteUrl: "https://x.ai",
    apiKeysUrl: "https://console.x.ai",
    logo: COMPANY_LOGOS.xai,
    models: [
      {
        id: "grok-3",
        name: "Grok 3",
        contextLength: 1000000,
        description: "Latest Grok model with massive context and real-time data",
        pricing: { inputPer1M: 2, outputPer1M: 8 },
        strengths: ["Real-time data", "Long context", "Current events"],
        recommended: true,
        maxOutputTokens: 32000,
      },
      {
        id: "grok-3-mini",
        name: "Grok 3 Mini",
        contextLength: 1000000,
        description: "Compact Grok model with reasoning capabilities",
        pricing: { inputPer1M: 0.5, outputPer1M: 2 },
        strengths: ["Reasoning", "Speed", "Cost-effective"],
        maxOutputTokens: 16000,
      },
    ],
  },

  meta: {
    id: "meta",
    name: "Meta AI",
    description: "Open-source Llama models for various applications",
    baseURL: "https://api.together.xyz/v1",
    requiresApiKey: true,
    supportsStreaming: true,
    supportsTools: true,
    supportsImages: true,
    supportsWebSearch: false,
    websiteUrl: "https://ai.meta.com",
    apiKeysUrl: "https://api.together.xyz/settings/api-keys",
    freeTier: true,
    logo: COMPANY_LOGOS.meta,
    models: [
      {
        id: "meta-llama/llama-4-maverick",
        name: "Llama 4 Maverick",
        contextLength: 1000000,
        description: "Meta's latest open-source powerhouse with massive context",
        pricing: { inputPer1M: 0.5, outputPer1M: 0.75 },
        strengths: ["Open source", "Coding", "Math", "Long context"],
        recommended: true,
        maxOutputTokens: 32000,
      },
      {
        id: "meta-llama/llama-4-scout",
        name: "Llama 4 Scout",
        contextLength: 10000000,
        description: "Ultra-long context model for massive document processing",
        pricing: { inputPer1M: 1, outputPer1M: 1.5 },
        strengths: ["Ultra-long context", "Document analysis", "Research"],
        maxOutputTokens: 32000,
      },
      {
        id: "meta-llama/llama-3.3-70b-instruct",
        name: "Llama 3.3 70B",
        contextLength: 128000,
        description: "Powerful open-source model for general use",
        pricing: { inputPer1M: 0.5, outputPer1M: 0.75 },
        strengths: ["Open source", "Coding", "Math"],
        maxOutputTokens: 8192,
      },
    ],
  },

  mistral: {
    id: "mistral",
    name: "Mistral AI",
    description: "European AI company with efficient and powerful models",
    baseURL: "https://api.mistral.ai/v1",
    requiresApiKey: true,
    supportsStreaming: true,
    supportsTools: true,
    supportsImages: false,
    supportsWebSearch: false,
    websiteUrl: "https://mistral.ai",
    apiKeysUrl: "https://console.mistral.ai",
    logo: COMPANY_LOGOS.mistral,
    models: [
      {
        id: "mistral-large-2",
        name: "Mistral Large 2",
        contextLength: 128000,
        description: "Mistral's most capable model for complex tasks",
        pricing: { inputPer1M: 2, outputPer1M: 6 },
        strengths: ["Reasoning", "Coding", "Multilingual"],
        recommended: true,
        maxOutputTokens: 8192,
      },
      {
        id: "mistral-medium-3",
        name: "Mistral Medium 3",
        contextLength: 128000,
        description: "Balanced model for everyday tasks",
        pricing: { inputPer1M: 0.7, outputPer1M: 2.1 },
        strengths: ["Balanced", "General purpose", "Cost-effective"],
        maxOutputTokens: 8192,
      },
      {
        id: "codestral",
        name: "Codestral",
        contextLength: 256000,
        description: "Specialized coding model with massive context",
        pricing: { inputPer1M: 0.2, outputPer1M: 0.6 },
        strengths: ["Coding", "Long context", "Code generation"],
        maxOutputTokens: 8192,
      },
    ],
  },

  perplexity: {
    id: "perplexity",
    name: "Perplexity",
    description: "AI-powered search and reasoning platform",
    baseURL: "https://api.perplexity.ai",
    requiresApiKey: true,
    supportsStreaming: true,
    supportsWebSearch: true,
    websiteUrl: "https://perplexity.ai",
    apiKeysUrl: "https://perplexity.ai/settings/api",
    freeTier: true,
    logo: COMPANY_LOGOS.perplexity,
    models: [
      {
        id: "llama-3.1-sonar-large-128k-online",
        name: "Sonar Large Online",
        contextLength: 127072,
        maxOutputTokens: 4096,
        description: "Real-time web search with reasoning",
        pricing: { inputPer1M: 1.00, outputPer1M: 1.00 },
        strengths: ["Real-time search", "Factual", "Citations"],
        recommended: true
      },
      {
        id: "llama-3.1-sonar-small-128k-online",
        name: "Sonar Small Online",
        contextLength: 127072,
        maxOutputTokens: 4096,
        description: "Fast web search model",
        pricing: { inputPer1M: 0.20, outputPer1M: 0.20 },
        strengths: ["Speed", "Web search", "Cost-effective"]
      }
    ]
  },

  cohere: {
    id: "cohere",
    name: "Cohere",
    description: "Enterprise-focused language models",
    baseURL: "https://api.cohere.com/v1",
    requiresApiKey: true,
    supportsStreaming: true,
    supportsTools: true,
    websiteUrl: "https://cohere.com",
    apiKeysUrl: "https://dashboard.cohere.com/api-keys",
    freeTier: true,
    logo: COMPANY_LOGOS.cohere,
    models: [
      {
        id: "command-r-plus",
        name: "Command R+",
        contextLength: 128000,
        maxOutputTokens: 4096,
        description: "Most capable model for complex tasks",
        pricing: { inputPer1M: 3.00, outputPer1M: 15.00 },
        strengths: ["RAG", "Tool use", "Multilingual"],
        recommended: true
      },
      {
        id: "command-r",
        name: "Command R",
        contextLength: 128000,
        maxOutputTokens: 4096,
        description: "Balanced model for everyday tasks",
        pricing: { inputPer1M: 0.50, outputPer1M: 1.50 },
        strengths: ["RAG", "Balanced", "Enterprise"]
      }
    ]
  },

  reka: {
    id: "reka",
    name: "Reka AI",
    description: "Multimodal AI models built by ex-Google researchers",
    baseURL: "https://api.reka.ai/v1",
    requiresApiKey: true,
    supportsStreaming: true,
    supportsImages: true,
    websiteUrl: "https://reka.ai",
    apiKeysUrl: "https://platform.reka.ai",
    logo: COMPANY_LOGOS.reka,
    models: [
      {
        id: "reka-core",
        name: "Reka Core",
        contextLength: 128000,
        maxOutputTokens: 8192,
        description: "Flagship multimodal model",
        pricing: { inputPer1M: 10.00, outputPer1M: 25.00 },
        strengths: ["Multimodal", "Video understanding", "Research"],
        recommended: true
      },
      {
        id: "reka-flash",
        name: "Reka Flash",
        contextLength: 128000,
        maxOutputTokens: 8192,
        description: "Fast and efficient multimodal model",
        pricing: { inputPer1M: 0.80, outputPer1M: 2.00 },
        strengths: ["Speed", "Multimodal", "Cost-effective"]
      }
    ]
  }
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
