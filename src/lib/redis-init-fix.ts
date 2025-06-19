/**
 * Redis initialization fix
 * 
 * This module ensures Redis is properly initialized with environment variables
 */

// Force environment variable checking at module initialization
const url = import.meta.env.VITE_KV_REST_API_URL;
const token = import.meta.env.VITE_KV_REST_API_TOKEN;

if (import.meta.env.DEV) {
  console.log('🔧 Redis Init Fix - Environment check:', {
    hasUrl: !!url,
    hasToken: !!token,
    url: url || 'NOT SET',
    syncEngine: import.meta.env.VITE_USE_SCALABLE_SYNC_ENGINE,
  });
}

// Force Redis to use the environment variables
if (url && token && typeof window !== 'undefined') {
  // Store in window object for debugging
  (window as any).__REDIS_CONFIG = { url, token };
}

export { url as REDIS_URL, token as REDIS_TOKEN };