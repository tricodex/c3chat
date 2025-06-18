/**
 * Redis Cache Debug Helper
 * 
 * This module provides debugging utilities for the Redis cache
 */

import { getRedisCache } from './redis-cache';

export async function debugRedisViewport(threadId: string) {
  console.log('🔍 Debugging Redis viewport for thread:', threadId);
  
  const cache = getRedisCache();
  
  // Check if Redis is working
  try {
    const info = await cache.getStorageInfo();
    console.log('💾 Storage info:', info);
  } catch (error) {
    console.error('❌ Failed to get storage info:', error);
  }
  
  // Try to get viewport
  try {
    const viewport = await cache.getViewport(threadId);
    console.log('📊 Viewport result:', {
      threadId: viewport.threadId,
      messageCount: viewport.messages.length,
      hasMoreTop: viewport.hasMore.top,
      hasMoreBottom: viewport.hasMore.bottom,
      firstMessage: viewport.messages[0],
      lastMessage: viewport.messages[viewport.messages.length - 1],
    });
    return viewport;
  } catch (error) {
    console.error('❌ Failed to get viewport:', error);
    throw error;
  }
}

// Export to window for debugging
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).debugRedisViewport = debugRedisViewport;
  (window as any).getRedisCache = getRedisCache;
  console.log('💡 Debug helpers available: window.debugRedisViewport(threadId)');
}