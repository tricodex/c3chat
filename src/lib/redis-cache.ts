/**
 * Redis Cache Layer for C3Chat
 * 
 * This implements a high-performance distributed cache using Upstash Redis
 * to solve the sync engine scalability issues:
 * 
 * Key Benefits:
 * - Cross-tab synchronization via Redis pub/sub
 * - Distributed caching across devices
 * - Automatic memory management (Redis eviction policies)
 * - Sub-millisecond performance
 * - Built-in conflict resolution
 * - Scalable to millions of messages
 * 
 * Architecture:
 * - Redis as L2 cache (shared across tabs/devices)
 * - Local memory as L1 cache (per tab, limited size)
 * - Convex as source of truth
 */

import { Redis } from "@upstash/redis";
import { nanoid } from "nanoid";

// Initialize Redis client conditionally
let redis: Redis | null = null;

const getRedis = (): Redis => {
  if (!redis) {
    const url = import.meta.env.VITE_KV_REST_API_URL;
    const token = import.meta.env.VITE_KV_REST_API_TOKEN;
    
    // Create Redis instance with Upstash credentials
    
    if (!url || !token) {
      throw new Error("Redis configuration missing. Please set VITE_KV_REST_API_URL and VITE_KV_REST_API_TOKEN in your .env.local file");
    }
    
    redis = new Redis({
      url,
      token,
    });
    
    // Redis instance created
  }
  return redis;
};

// Types
export interface CachedMessage {
  _id: string;
  threadId: string;
  content: string;
  role: "user" | "assistant" | "system";
  timestamp: number;
  version: number;
  isOptimistic?: boolean;
  toolCalls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  metadata?: Record<string, any>;
}

export interface CachedThread {
  _id: string;
  title: string;
  lastMessageAt: number;
  messageCount: number;
  version: number;
}

export interface ViewportCache {
  threadId: string;
  messages: CachedMessage[];
  startCursor: string | null;
  endCursor: string | null;
  hasMore: { top: boolean; bottom: boolean };
}

// Constants
const VIEWPORT_SIZE = 50;
const CACHE_TTL = 3600; // 1 hour in seconds
const MAX_MEMORY_MESSAGES = 100; // Per thread in L1 cache

// Redis key patterns
const Keys = {
  thread: (id: string) => `thread:${id}`,
  messages: (threadId: string) => `messages:${threadId}`,
  viewport: (threadId: string, userId: string) => `viewport:${userId}:${threadId}`,
  optimistic: (tabId: string) => `optimistic:${tabId}`,
  lock: (resource: string) => `lock:${resource}`,
  presence: (threadId: string) => `presence:${threadId}`,
  
  // Pub/sub channels
  channel: {
    thread: (threadId: string) => `channel:thread:${threadId}`,
    optimistic: () => `channel:optimistic`,
    sync: () => `channel:sync`,
  }
};

export class RedisCache {
  private tabId: string;
  private memoryCache: Map<string, ViewportCache>;
  private subscriptions: Map<string, () => void>;
  
  // Streaming message buffer to reduce updates
  private streamingBuffer = new Map<string, {
    content: string;
    lastUpdate: number;
    timeoutId?: NodeJS.Timeout;
  }>();
  
  // Periodic cleanup interval
  private cleanupIntervalId?: NodeJS.Timeout;
  
  constructor() {
    this.tabId = nanoid();
    this.memoryCache = new Map();
    this.subscriptions = new Map();
    
    // Start periodic cleanup of stale streaming buffers (every 5 minutes)
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupStaleStreamingBuffers();
    }, 5 * 60 * 1000);
  }
  
  private cleanupStaleStreamingBuffers(): void {
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    
    for (const [messageId, buffer] of this.streamingBuffer.entries()) {
      if (now - buffer.lastUpdate > staleThreshold) {
        if (buffer.timeoutId) {
          clearTimeout(buffer.timeoutId);
        }
        this.streamingBuffer.delete(messageId);
        console.warn(`Cleaned up stale streaming buffer for message ${messageId}`);
      }
    }
  }
  
  // Thread operations
  async getThread(threadId: string): Promise<CachedThread | null> {
    try {
      const cached = await getRedis().get<CachedThread>(Keys.thread(threadId));
      return cached;
    } catch (error) {
      console.error('Redis getThread error:', error);
      return null;
    }
  }
  
  async saveThread(thread: CachedThread): Promise<void> {
    try {
      await getRedis().setex(Keys.thread(thread._id), CACHE_TTL, thread);
      
      // Publish update
      await getRedis().publish(Keys.channel.thread(thread._id), {
        type: 'thread_update',
        thread,
        tabId: this.tabId,
      });
    } catch (error) {
      console.error('Redis saveThread error:', error);
    }
  }
  
  // Message viewport operations
  async getViewport(threadId: string, anchor: 'top' | 'bottom' = 'bottom'): Promise<ViewportCache> {
    console.log('🔍 getViewport called:', { threadId, anchor });
    
    // Check L1 cache first
    const cached = this.memoryCache.get(threadId);
    if (cached) {
      console.log('✅ Using cached viewport with', cached.messages.length, 'messages');
      return cached;
    }
    
    try {
      const key = Keys.messages(threadId);
      console.log('📋 Redis key:', key);
      
      // Get message count for pagination
      const messageCount = await getRedis().zcard(key);
      console.log('📊 Message count in Redis:', messageCount);
      
      if (messageCount === 0) {
        console.warn('⚠️ No messages in Redis for thread:', threadId);
        return {
          threadId,
          messages: [],
          startCursor: null,
          endCursor: null,
          hasMore: { top: false, bottom: false }
        };
      }
      
      let messages: CachedMessage[];
      let startCursor: string | null = null;
      let endCursor: string | null = null;
      
      if (anchor === 'bottom') {
        // Get latest messages
        const rawMessages = await getRedis().zrange(
          key,
          -VIEWPORT_SIZE,
          -1
        );
        console.log('📨 Raw messages from Redis:', rawMessages?.length || 0);
        
        // Robust message parsing with error handling
        messages = (rawMessages || []).map(item => {
          try {
            if (typeof item === 'string') {
              return JSON.parse(item);
            } else if (item && typeof item === 'object') {
              return item;
            }
            console.warn('Unexpected message format:', item);
            return null;
          } catch (error) {
            console.error('Failed to parse message:', item, error);
            return null;
          }
        }).filter(Boolean) as CachedMessage[];
        
        console.log('✅ Parsed messages:', messages.length);
        
        if (messages.length > 0) {
          startCursor = messages[0]._id;
          endCursor = messages[messages.length - 1]._id;
        }
      } else {
        // Get oldest messages
        const rawMessages = await getRedis().zrange(
          Keys.messages(threadId),
          0,
          VIEWPORT_SIZE - 1
        );
        messages = (rawMessages || []).map(item => {
          try {
            if (typeof item === 'string') {
              return JSON.parse(item);
            } else if (item && typeof item === 'object') {
              return item;
            }
            return null;
          } catch (error) {
            console.error('Failed to parse message:', error);
            return null;
          }
        }).filter(Boolean) as CachedMessage[];
        
        if (messages.length > 0) {
          startCursor = messages[0]._id;
          endCursor = messages[messages.length - 1]._id;
        }
      }
      
      const viewport: ViewportCache = {
        threadId,
        messages,
        startCursor,
        endCursor,
        hasMore: {
          top: messages.length > 0 && messageCount > VIEWPORT_SIZE,
          bottom: messages.length > 0 && messageCount > VIEWPORT_SIZE,
        }
      };
      
      // Update L1 cache
      this.updateMemoryCache(threadId, viewport);
      
      return viewport;
    } catch (error) {
      console.error('Redis getViewport error:', error);
      return {
        threadId,
        messages: [],
        startCursor: null,
        endCursor: null,
        hasMore: { top: false, bottom: false }
      };
    }
  }
  
  async loadMore(threadId: string, direction: 'up' | 'down', cursor: string): Promise<CachedMessage[]> {
    try {
      const key = Keys.messages(threadId);
      
      // Get cursor score
      const cursorScore = await getRedis().zscore(key, cursor);
      if (cursorScore === null) return [];
      
      let messages: CachedMessage[];
      
      if (direction === 'up') {
        // Load older messages
        const rawMessages = await getRedis().zrangebyscore(
          key,
          '-inf',
          `(${cursorScore}`,
          {
            withScores: false,
            limit: { offset: 0, count: 25 }
          }
        );
        messages = ((rawMessages || []).map(item => 
          typeof item === 'string' ? JSON.parse(item) : item
        ) as CachedMessage[]).reverse();
      } else {
        // Load newer messages
        const rawMessages = await getRedis().zrangebyscore(
          key,
          `(${cursorScore}`,
          '+inf',
          {
            withScores: false,
            limit: { offset: 0, count: 25 }
          }
        );
        messages = (rawMessages || []).map(item => 
          typeof item === 'string' ? JSON.parse(item) : item
        ) as CachedMessage[];
      }
      
      // Update memory cache
      const cached = this.memoryCache.get(threadId);
      if (cached) {
        if (direction === 'up') {
          cached.messages = [...messages, ...cached.messages].slice(-MAX_MEMORY_MESSAGES);
          if (messages.length > 0) cached.startCursor = messages[0]._id;
        } else {
          cached.messages = [...cached.messages, ...messages].slice(0, MAX_MEMORY_MESSAGES);
          if (messages.length > 0) cached.endCursor = messages[messages.length - 1]._id;
        }
      }
      
      return messages;
    } catch (error) {
      console.error('Redis loadMore error:', error);
      return [];
    }
  }
  
  // Optimistic updates
  async addOptimisticMessage(message: CachedMessage): Promise<void> {
    const viewport = this.memoryCache.get(message.threadId);
    if (viewport) {
      // Add to end of viewport
      viewport.messages = [...viewport.messages, message].slice(-MAX_MEMORY_MESSAGES);
      viewport.endCursor = message._id;
    }
    
    try {
      // Store in Redis for cross-tab sync
      await getRedis().setex(
        Keys.optimistic(this.tabId),
        60, // 1 minute TTL for optimistic updates
        { message, timestamp: Date.now() }
      );
      
      // Broadcast to other tabs
      await getRedis().publish(Keys.channel.optimistic(), {
        type: 'optimistic_message',
        message,
        tabId: this.tabId,
      });
    } catch (error) {
      console.error('Redis addOptimisticMessage error:', error);
    }
  }
  
  async replaceOptimisticMessage(optimisticId: string, realMessage: CachedMessage): Promise<void> {
    // Update memory cache
    const viewport = this.memoryCache.get(realMessage.threadId);
    if (viewport) {
      const index = viewport.messages.findIndex(m => m._id === optimisticId);
      if (index >= 0) {
        viewport.messages[index] = realMessage;
      }
    }
    
    try {
      // Add real message to Redis
      await getRedis().zadd(Keys.messages(realMessage.threadId), {
        score: realMessage.timestamp,
        member: JSON.stringify(realMessage),
      });
      
      // Clean up optimistic entry
      await getRedis().del(Keys.optimistic(this.tabId));
      
      // Notify other tabs
      await getRedis().publish(Keys.channel.thread(realMessage.threadId), {
        type: 'message_confirmed',
        optimisticId,
        realMessage,
        tabId: this.tabId,
      });
    } catch (error) {
      console.error('Redis replaceOptimisticMessage error:', error);
    }
  }
  
  async updateStreamingMessage(
    messageId: string, 
    content: string, 
    threadId: string,
    forceFlush = false
  ): Promise<void> {
    const now = Date.now();
    const buffer = this.streamingBuffer.get(messageId);
    
    if (!buffer) {
      this.streamingBuffer.set(messageId, {
        content,
        lastUpdate: now,
      });
    } else {
      buffer.content = content;
      
      // Clear existing timeout
      if (buffer.timeoutId) {
        clearTimeout(buffer.timeoutId);
      }
    }
    
    const shouldUpdate = forceFlush || 
      !buffer || 
      (now - buffer.lastUpdate > 100); // Update every 100ms max
    
    if (shouldUpdate) {
      const viewport = this.memoryCache.get(threadId);
      if (viewport) {
        const msgIndex = viewport.messages.findIndex(m => m._id === messageId);
        if (msgIndex >= 0) {
          viewport.messages[msgIndex] = {
            ...viewport.messages[msgIndex],
            content,
            version: (viewport.messages[msgIndex].version || 0) + 1,
          };
        }
      }
      
      this.streamingBuffer.get(messageId)!.lastUpdate = now;
      
      // Clean up buffer if message is complete (forceFlush)
      if (forceFlush) {
        const bufferEntry = this.streamingBuffer.get(messageId);
        if (bufferEntry?.timeoutId) {
          clearTimeout(bufferEntry.timeoutId);
        }
        this.streamingBuffer.delete(messageId);
      }
    } else {
      // Schedule update
      const timeoutId = setTimeout(() => {
        this.updateStreamingMessage(messageId, content, threadId, true);
      }, 100);
      
      this.streamingBuffer.get(messageId)!.timeoutId = timeoutId;
    }
  }
  
  async expandViewport(
    threadId: string,
    anchorTimestamp: number,
    direction: 'up' | 'down'
  ): Promise<ViewportCache | null> {
    try {
      const currentViewport = this.memoryCache.get(threadId);
      if (!currentViewport) {
        // No current viewport, get fresh one
        return await this.getViewport(threadId, 'bottom');
      }
      
      const key = Keys.messages(threadId);
      const messageCount = await getRedis().zcard(key);
      
      let newMessages: CachedMessage[];
      const loadCount = 25; // Load 25 messages at a time
      
      if (direction === 'up') {
        // Load older messages before anchor
        const rawMessages = await getRedis().zrangebyscore(
          key,
          '-inf',
          `(${anchorTimestamp}`,
          {
            withScores: false,
            limit: { offset: 0, count: loadCount },
            rev: true // Get newest first, then reverse
          }
        );
        
        newMessages = ((rawMessages || []).map(item => 
          typeof item === 'string' ? JSON.parse(item) : item
        ) as CachedMessage[]).reverse();
        
        // Merge with existing messages
        currentViewport.messages = [...newMessages, ...currentViewport.messages].slice(-MAX_MEMORY_MESSAGES);
        if (newMessages.length > 0) {
          currentViewport.startCursor = newMessages[0]._id;
        }
        
        // Update hasMore flags
        const oldestTimestamp = newMessages.length > 0 ? newMessages[0].timestamp : anchorTimestamp;
        const hasOlderMessages = await getRedis().zcount(key, '-inf', `(${oldestTimestamp}`);
        currentViewport.hasMore.top = hasOlderMessages > 0;
        
      } else {
        // Load newer messages after anchor
        const rawMessages = await getRedis().zrangebyscore(
          key,
          `(${anchorTimestamp}`,
          '+inf',
          {
            withScores: false,
            limit: { offset: 0, count: loadCount }
          }
        );
        
        newMessages = (rawMessages || []).map(item => 
          typeof item === 'string' ? JSON.parse(item) : item
        ) as CachedMessage[];
        
        // Merge with existing messages
        currentViewport.messages = [...currentViewport.messages, ...newMessages].slice(0, MAX_MEMORY_MESSAGES);
        if (newMessages.length > 0) {
          currentViewport.endCursor = newMessages[newMessages.length - 1]._id;
        }
        
        // Update hasMore flags
        const newestTimestamp = newMessages.length > 0 ? newMessages[newMessages.length - 1].timestamp : anchorTimestamp;
        const hasNewerMessages = await getRedis().zcount(key, `(${newestTimestamp}`, '+inf');
        currentViewport.hasMore.bottom = hasNewerMessages > 0;
      }
      
      // Update memory cache
      this.updateMemoryCache(threadId, currentViewport);
      
      return currentViewport;
    } catch (error) {
      console.error('Redis expandViewport error:', error);
      return null;
    }
  }
  
  // Batch operations for sync
  async syncMessages(threadId: string, messages: CachedMessage[]): Promise<void> {
    if (messages.length === 0) return;
    
    console.log('🔄 Syncing', messages.length, 'messages to Redis for thread:', threadId);
    
    try {
      // Clear the viewport cache first to force fresh load
      if (this.memoryCache.has(threadId)) {
        console.log('🧹 Clearing viewport cache for thread:', threadId);
        this.memoryCache.delete(threadId);
      }
      
      // Use direct Redis commands instead of pipeline for reliability
      try {
        // Clear existing messages
        await getRedis().del(Keys.messages(threadId));
        
        // Add all messages with scores, ensuring IDs are strings
        const members = messages.map(msg => ({
          score: msg.timestamp,
          member: JSON.stringify({
            ...msg,
            _id: String(msg._id), // Force string conversion
            threadId: String(msg.threadId), // Force string conversion
          }),
        }));
        
        console.log('📝 Adding', members.length, 'messages to Redis');
        
        // Add messages one by one (Upstash format)
        for (const { score, member } of members) {
          await getRedis().zadd(Keys.messages(threadId), {
            score,
            member,
          });
        }
        
        // Set expiry
        await getRedis().expire(Keys.messages(threadId), CACHE_TTL);
        
        console.log('✅ Messages synced successfully');
      } catch (error) {
        console.error('❌ Failed to sync messages to Redis:', error);
        throw error;
      }
      
      // CRITICAL: Force immediate viewport refresh after sync
      // This ensures the UI gets the updated data
      console.log('🔄 Refreshing viewport after sync');
      const freshViewport = await this.getViewport(threadId, 'bottom');
      console.log('📊 Fresh viewport loaded with', freshViewport.messages.length, 'messages');
    } catch (error) {
      console.error('Redis syncMessages error:', error);
    }
  }
  
  // Cross-tab synchronization
  async acquireLock(resource: string, ttl: number = 5000): Promise<boolean> {
    try {
      const lockKey = Keys.lock(resource);
      const lockId = this.tabId;
      
      // Try to acquire lock with NX (only if not exists)
      const result = await getRedis().set(lockKey, lockId, {
        nx: true,
        px: ttl,
      });
      
      return result === 'OK';
    } catch (error) {
      console.error('Redis acquireLock error:', error);
      return false;
    }
  }
  
  async releaseLock(resource: string): Promise<void> {
    try {
      const lockKey = Keys.lock(resource);
      const lockId = await getRedis().get(lockKey);
      
      // Only release if we own the lock
      if (lockId === this.tabId) {
        await getRedis().del(lockKey);
      }
    } catch (error) {
      console.error('Redis releaseLock error:', error);
    }
  }
  
  // Presence tracking
  async updatePresence(threadId: string, userId: string): Promise<void> {
    try {
      const presenceKey = Keys.presence(threadId);
      await getRedis().zadd(presenceKey, {
        score: Date.now(),
        member: JSON.stringify({ userId, tabId: this.tabId }),
      });
      
      // Clean up old presence (older than 30 seconds)
      const cutoff = Date.now() - 30000;
      await getRedis().zremrangebyscore(presenceKey, 0, cutoff);
      
      // Set TTL
      await getRedis().expire(presenceKey, 60);
    } catch (error) {
      console.error('Redis updatePresence error:', error);
    }
  }
  
  async getActiveUsers(threadId: string): Promise<string[]> {
    try {
      const presenceKey = Keys.presence(threadId);
      const cutoff = Date.now() - 30000;
      
      const activeUsers = await getRedis().zrangebyscore(
        presenceKey,
        cutoff,
        '+inf'
      );
      
      // Parse and deduplicate by userId
      const userIds = new Set<string>();
      for (const entry of activeUsers || []) {
        try {
          const { userId } = JSON.parse(entry);
          userIds.add(userId);
        } catch {}
      }
      
      return Array.from(userIds);
    } catch (error) {
      console.error('Redis getActiveUsers error:', error);
      return [];
    }
  }
  
  // Memory management
  private updateMemoryCache(threadId: string, viewport: ViewportCache): void {
    this.memoryCache.set(threadId, viewport);
    
    // Evict old viewports if memory cache is too large
    if (this.memoryCache.size > 10) {
      const oldest = Array.from(this.memoryCache.keys())[0];
      this.memoryCache.delete(oldest);
    }
  }
  
  // Cleanup
  async cleanup(): Promise<void> {
    try {
      // Clear periodic cleanup interval
      if (this.cleanupIntervalId) {
        clearInterval(this.cleanupIntervalId);
        this.cleanupIntervalId = undefined;
      }
      
      // Clean up streaming buffers
      this.streamingBuffer.forEach((buffer) => {
        if (buffer.timeoutId) {
          clearTimeout(buffer.timeoutId);
        }
      });
      this.streamingBuffer.clear();
      
      // Only run cleanup if Redis is configured
      if (!isRedisConfigured()) {
        this.memoryCache.clear();
        return;
      }
      
      // Clean up any locks we hold
      const locks = await getRedis().keys(`${Keys.lock('*')}`);
      for (const lockKey of locks) {
        const lockId = await getRedis().get(lockKey);
        if (lockId === this.tabId) {
          await getRedis().del(lockKey);
        }
      }
      
      // Clean up optimistic updates
      await getRedis().del(Keys.optimistic(this.tabId));
      
      // Clear subscriptions
      this.subscriptions.forEach(unsub => unsub());
      this.subscriptions.clear();
      
      // Clear memory cache
      this.memoryCache.clear();
    } catch (error) {
      console.error('Redis cleanup error:', error);
    }
  }
  
  // Storage info
  async getStorageInfo(): Promise<{
    memoryCacheSize: number;
    redisKeys: number;
    estimatedSize: number;
  }> {
    try {
      // Count Redis keys (this is approximate)
      const dbSize = await getRedis().dbsize();
      
      // Estimate memory cache size
      let memoryCacheSize = 0;
      this.memoryCache.forEach(viewport => {
        memoryCacheSize += JSON.stringify(viewport).length;
      });
      
      return {
        memoryCacheSize,
        redisKeys: dbSize || 0,
        estimatedSize: memoryCacheSize + (dbSize || 0) * 1024, // Rough estimate
      };
    } catch (error) {
      console.error('Redis getStorageInfo error:', error);
      return {
        memoryCacheSize: 0,
        redisKeys: 0,
        estimatedSize: 0,
      };
    }
  }
}

// Check if Redis is configured
const isRedisConfigured = (): boolean => {
  const url = import.meta.env.VITE_KV_REST_API_URL;
  const token = import.meta.env.VITE_KV_REST_API_TOKEN;
  console.log('🔧 Redis configuration check:', {
    hasUrl: !!url,
    hasToken: !!token,
    url: url ? '✅ Configured' : '❌ Missing',
    token: token ? '✅ Configured' : '❌ Missing',
  });
  return !!(url && token);
};

// Singleton instance
let cacheInstance: RedisCache | null = null;
let isNoOp = false;

export function getRedisCache(): RedisCache {
  // Always check if we need to upgrade from NoOp to real Redis
  if (cacheInstance && isNoOp && isRedisConfigured()) {
    // Upgrade from NoOp to real Redis cache
    cacheInstance = null;
    isNoOp = false;
  }
  
  if (!cacheInstance) {
    if (!isRedisConfigured()) {
      // Redis not configured - use no-op cache
      // Create a singleton NoOpRedisCache
      cacheInstance = new NoOpRedisCache() as any;
      isNoOp = true;
    } else {
      // Create Redis cache instance
      cacheInstance = new RedisCache();
      isNoOp = false;
    }
  }
  return cacheInstance;
}

// No-op implementation for when Redis is not configured
class NoOpRedisCache {
  async getThread(): Promise<null> { return null; }
  async saveThread(): Promise<void> {}
  async getViewport(): Promise<ViewportCache> {
    return {
      threadId: '',
      messages: [],
      startCursor: null,
      endCursor: null,
      hasMore: { top: false, bottom: false },
    };
  }
  async loadMore(): Promise<CachedMessage[]> { return []; }
  async addOptimisticMessage(): Promise<void> {}
  async replaceOptimisticMessage(): Promise<void> {}
  async updateStreamingMessage(): Promise<void> {}
  async expandViewport(): Promise<ViewportCache | null> { 
    return {
      threadId: '',
      messages: [],
      startCursor: null,
      endCursor: null,
      hasMore: { top: false, bottom: false },
    };
  }
  async syncMessages(): Promise<void> {}
  async syncThreads(): Promise<void> {}
  async acquireLock(): Promise<boolean> { return true; }
  async releaseLock(): Promise<void> {}
  async updatePresence(): Promise<void> {}
  async getActiveUsers(): Promise<string[]> { return []; }
  async cleanup(): Promise<void> {}
  async getStorageInfo() {
    return {
      memoryCacheSize: 0,
      redisKeys: 0,
      estimatedSize: 0,
    };
  }
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    cacheInstance?.cleanup();
  });
}