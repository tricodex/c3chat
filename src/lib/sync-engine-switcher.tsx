/**
 * Sync Engine Switcher
 * 
 * This module provides a unified interface to switch between the old
 * corrected sync engine and the new scalable sync engine with Redis.
 * 
 * Switching is controlled by the VITE_USE_SCALABLE_SYNC_ENGINE environment variable.
 * Set to "true" to use the new scalable sync engine, any other value uses the old one.
 * 
 * Both engines provide the same hooks and API to ensure compatibility:
 * - useEnhancedSync()
 * - useThreads()
 * - useMessages(threadId)
 * - useSelectedThread()
 * - useOnlineStatus()
 * - useOfflineCapability()
 * - useSyncStatus()
 * - EnhancedSyncProvider
 */

import React from 'react';

// Import old sync engine
import {
  EnhancedSyncProvider as OldSyncProvider,
  useEnhancedSync as useOldSync,
  useThreads as useOldThreads,
  useMessages as useOldMessages,
  useSelectedThread as useOldSelectedThread,
  useOnlineStatus as useOldOnlineStatus,
  useOfflineCapability as useOldOfflineCapability,
  useSyncStatus as useOldSyncStatus,
} from './corrected-sync-engine';

// Import new enhanced sync engine with all hooks
import {
  EnhancedSyncProvider as NewSyncProvider,
  useEnhancedSync as useNewSync,
  useThreads as useNewThreads,
  useMessages as useNewMessages,
  useSelectedThread as useNewSelectedThread,
  useOnlineStatus as useNewOnlineStatus,
  useOfflineCapability as useNewOfflineCapability,
  useSyncStatus as useNewSyncStatus,
  useActiveUsers,
} from './scalable-sync-engine-v2';

// Check which sync engine to use
const USE_SCALABLE_SYNC = import.meta.env.VITE_USE_SCALABLE_SYNC_ENGINE === 'true';

// Log which engine is being used
if (typeof window !== 'undefined') {
  console.log(`🚀 Using ${USE_SCALABLE_SYNC ? 'NEW Scalable' : 'OLD Corrected'} Sync Engine`);
  if (USE_SCALABLE_SYNC) {
    console.log('✨ Redis caching enabled:', import.meta.env.VITE_ENABLE_REDIS_CACHE === 'true');
  }
}

// Unified exports that work with both engines
export const EnhancedSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (USE_SCALABLE_SYNC) {
    return <NewSyncProvider>{children}</NewSyncProvider>;
  }
  return <OldSyncProvider>{children}</OldSyncProvider>;
};

export const useEnhancedSync = () => {
  if (USE_SCALABLE_SYNC) {
    return useNewSync();
  }
  return useOldSync();
};

export const useThreads = () => {
  if (USE_SCALABLE_SYNC) {
    return useNewThreads();
  }
  return useOldThreads();
};

export const useMessages = (threadId?: string) => {
  if (USE_SCALABLE_SYNC) {
    return useNewMessages(threadId || null);
  }
  return useOldMessages(threadId);
};

export const useSelectedThread = () => {
  if (USE_SCALABLE_SYNC) {
    return useNewSelectedThread();
  }
  return useOldSelectedThread();
};

export const useOnlineStatus = () => {
  if (USE_SCALABLE_SYNC) {
    return useNewOnlineStatus();
  }
  return useOldOnlineStatus();
};

export const useOfflineCapability = () => {
  if (USE_SCALABLE_SYNC) {
    return useNewOfflineCapability();
  }
  return useOldOfflineCapability();
};

export const useSyncStatus = () => {
  if (USE_SCALABLE_SYNC) {
    return useNewSyncStatus();
  }
  return useOldSyncStatus();
};

// Export the active users hook (only available in new engine)
export { useActiveUsers };

// Re-export types for compatibility
export type { Thread, Message } from './corrected-sync-engine';