/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string;
  readonly VITE_KV_REST_API_URL: string;
  readonly VITE_KV_REST_API_TOKEN: string;
  readonly VITE_ENABLE_REDIS_CACHE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
