/**
 * Security Initializer Component
 * Handles API key migration and encryption setup on app startup
 */

import { useEffect, useState } from 'react';
import { migrateApiKeys } from '../lib/ai-providers';
import { isCryptoAvailable } from '../lib/crypto-utils';

export function SecurityInitializer({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Check if Web Crypto API is available
        if (!isCryptoAvailable()) {
          console.warn('Web Crypto API not available. API keys will be stored without encryption.');
        }

        // Migrate existing API keys to encrypted storage
        await migrateApiKeys();
        
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize security:', err);
        setError('Failed to initialize secure storage');
        // Still allow app to work even if migration fails
        setIsInitialized(true);
      }
    };

    initialize();
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--c3-bg-primary)]">
        <div className="text-center">
          <div className="text-[var(--c3-text-primary)] mb-2">Initializing secure storage...</div>
          {error && (
            <div className="text-[var(--c3-error)] text-sm">{error}</div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}