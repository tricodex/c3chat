// Debug environment variables
export function debugEnv() {
  console.log('🔍 Environment Debug:', {
    VITE_KV_REST_API_URL: import.meta.env.VITE_KV_REST_API_URL,
    VITE_KV_REST_API_TOKEN: import.meta.env.VITE_KV_REST_API_TOKEN ? '✅ Set' : '❌ Not set',
    VITE_USE_SCALABLE_SYNC_ENGINE: import.meta.env.VITE_USE_SCALABLE_SYNC_ENGINE,
    DEV: import.meta.env.DEV,
    MODE: import.meta.env.MODE,
    all: import.meta.env,
  });
}

// Call on import
if (import.meta.env.DEV) {
  debugEnv();
}