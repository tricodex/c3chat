/**
 * Enhanced Scalable Sync Engine with Redis Integration
 * 
 * This is an enhanced version of the scalable sync engine that provides
 * full compatibility with the old sync engine interface while adding
 * Redis caching capabilities.
 * 
 * Enhancements:
 * - Added useThreads() hook
 * - Added useOnlineStatus() hook 
 * - Added useSyncStatus() hook
 * - Ensured all hooks match the old interface
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { RedisCache, CachedMessage, CachedThread, ViewportCache, getRedisCache } from './redis-cache';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';

// Re-export all types and components from the original
export * from './scalable-sync-engine';

// Import the original provider and context
import {
  ScalableSyncProvider as OriginalProvider,
  useScalableSync,
  useMessages as originalUseMessages,
  useSelectedThread as originalUseSelectedThread,
  useOfflineCapability as originalUseOfflineCapability,
  useActiveUsers,
} from './scalable-sync-engine';

// Add the missing hooks

/**
 * Hook to get all threads
 * Provides compatibility with old sync engine
 */
export const useThreads = () => {
  const { state } = useScalableSync();
  return state.threads;
};

/**
 * Hook to get online status
 * Provides compatibility with old sync engine
 */
export const useOnlineStatus = () => {
  const { state } = useScalableSync();
  return state.isOnline;
};

/**
 * Hook to get sync status
 * Provides compatibility with old sync engine
 */
export const useSyncStatus = () => {
  const { state } = useScalableSync();
  return {
    isSyncing: state.isSyncing,
    lastSyncTime: state.lastSyncTime,
    error: state.error,
    pendingOperations: state.pendingOperations.size,
  };
};

// Re-export the original hooks with the same names
export const useMessages = originalUseMessages;
export const useSelectedThread = originalUseSelectedThread;
export const useOfflineCapability = originalUseOfflineCapability;

// Re-export the provider
export const ScalableSyncProvider = OriginalProvider;

// Also export with the old name for compatibility
export const EnhancedSyncProvider = ScalableSyncProvider;
export const useEnhancedSync = useScalableSync;