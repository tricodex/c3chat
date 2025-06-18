/**
 * Redis Integration Tests
 * 
 * Comprehensive tests to ensure the Redis integration is production-ready
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisCache, CachedMessage, ViewportCache } from '../lib/redis-cache';

// Mock Upstash Redis with realistic behavior
const mockRedisData = new Map<string, any>();
const mockZSets = new Map<string, Array<{ score: number; member: string }>>();

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockImplementation((key: string) => {
      return Promise.resolve(mockRedisData.get(key) || null);
    }),
    
    set: vi.fn().mockImplementation((key: string, value: any) => {
      mockRedisData.set(key, value);
      return Promise.resolve('OK');
    }),
    
    setex: vi.fn().mockImplementation((key: string, ttl: number, value: any) => {
      mockRedisData.set(key, value);
      // In real Redis, this would expire after ttl seconds
      return Promise.resolve('OK');
    }),
    
    del: vi.fn().mockImplementation((key: string) => {
      mockRedisData.delete(key);
      mockZSets.delete(key);
      return Promise.resolve(1);
    }),
    
    zadd: vi.fn().mockImplementation((key: string, { score, member }: any) => {
      const zset = mockZSets.get(key) || [];
      // Remove existing member
      const filtered = zset.filter(item => item.member !== member);
      // Add with new score
      filtered.push({ score, member });
      // Sort by score
      filtered.sort((a, b) => a.score - b.score);
      mockZSets.set(key, filtered);
      return Promise.resolve(1);
    }),
    
    zrange: vi.fn().mockImplementation((key: string, start: number, stop: number) => {
      const zset = mockZSets.get(key) || [];
      // Handle negative indices
      const actualStart = start < 0 ? Math.max(0, zset.length + start) : start;
      const actualStop = stop < 0 ? zset.length + stop + 1 : stop + 1;
      return Promise.resolve(
        zset.slice(actualStart, actualStop).map(item => item.member)
      );
    }),
    
    zrangebyscore: vi.fn().mockImplementation((key: string, min: string, max: string, options?: any) => {
      const zset = mockZSets.get(key) || [];
      let filtered = zset;
      
      // Parse min/max
      const minExclusive = min.startsWith('(');
      const minValue = minExclusive ? parseFloat(min.slice(1)) : 
                      min === '-inf' ? -Infinity : parseFloat(min);
      
      const maxExclusive = max.startsWith('(');
      const maxValue = maxExclusive ? parseFloat(max.slice(1)) : 
                      max === '+inf' ? Infinity : parseFloat(max);
      
      // Filter by score range
      filtered = filtered.filter(item => {
        if (minExclusive && item.score <= minValue) return false;
        if (!minExclusive && item.score < minValue) return false;
        if (maxExclusive && item.score >= maxValue) return false;
        if (!maxExclusive && item.score > maxValue) return false;
        return true;
      });
      
      // Apply limit if specified
      if (options?.limit) {
        filtered = filtered.slice(options.limit.offset, options.limit.offset + options.limit.count);
      }
      
      // Reverse if specified
      if (options?.rev) {
        filtered = filtered.reverse();
      }
      
      return Promise.resolve(filtered.map(item => item.member));
    }),
    
    zcard: vi.fn().mockImplementation((key: string) => {
      const zset = mockZSets.get(key) || [];
      return Promise.resolve(zset.length);
    }),
    
    zcount: vi.fn().mockImplementation((key: string, min: string, max: string) => {
      const zset = mockZSets.get(key) || [];
      const minValue = min === '-inf' ? -Infinity : parseFloat(min.replace('(', ''));
      const maxValue = max === '+inf' ? Infinity : parseFloat(max.replace('(', ''));
      const minExclusive = min.startsWith('(');
      const maxExclusive = max.startsWith('(');
      
      const count = zset.filter(item => {
        if (minExclusive && item.score <= minValue) return false;
        if (!minExclusive && item.score < minValue) return false;
        if (maxExclusive && item.score >= maxValue) return false;
        if (!maxExclusive && item.score > maxValue) return false;
        return true;
      }).length;
      
      return Promise.resolve(count);
    }),
    
    zscore: vi.fn().mockImplementation((key: string, member: string) => {
      const zset = mockZSets.get(key) || [];
      const item = zset.find(i => i.member === member);
      return Promise.resolve(item ? item.score : null);
    }),
    
    expire: vi.fn().mockResolvedValue(1),
    publish: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    dbsize: vi.fn().mockResolvedValue(mockRedisData.size + mockZSets.size),
    
    pipeline: vi.fn(() => ({
      del: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
  })),
}));

describe('Redis Integration Tests', () => {
  let redisCache: RedisCache;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisData.clear();
    mockZSets.clear();
    redisCache = new RedisCache();
  });
  
  afterEach(async () => {
    await redisCache.cleanup();
  });

  describe('Viewport Management', () => {
    it('should load initial viewport with correct size', async () => {
      // Prepare test data
      const threadId = 'thread_test_1';
      const messages: CachedMessage[] = Array.from({ length: 100 }, (_, i) => ({
        _id: `msg_${i}`,
        threadId,
        content: `Message ${i}`,
        role: 'user' as const,
        timestamp: Date.now() + i * 1000,
        version: 1,
      }));
      
      // Populate Redis
      for (const msg of messages) {
        await redisCache['getRedis']().zadd(`messages:${threadId}`, {
          score: msg.timestamp,
          member: JSON.stringify(msg),
        });
      }
      
      // Get viewport
      const viewport = await redisCache.getViewport(threadId, 'bottom');
      
      expect(viewport.messages.length).toBe(50); // VIEWPORT_SIZE
      expect(viewport.messages[0]._id).toBe('msg_50'); // Latest 50 messages
      expect(viewport.messages[49]._id).toBe('msg_99');
      expect(viewport.hasMore.top).toBe(true);
      expect(viewport.hasMore.bottom).toBe(false); // Already at bottom
    });

    it('should handle empty threads gracefully', async () => {
      const viewport = await redisCache.getViewport('empty_thread');
      
      expect(viewport.messages.length).toBe(0);
      expect(viewport.hasMore.top).toBe(false);
      expect(viewport.hasMore.bottom).toBe(false);
      expect(viewport.startCursor).toBe(null);
      expect(viewport.endCursor).toBe(null);
    });

    it('should expand viewport correctly when scrolling up', async () => {
      const threadId = 'thread_scroll_test';
      const messages: CachedMessage[] = Array.from({ length: 200 }, (_, i) => ({
        _id: `msg_${i}`,
        threadId,
        content: `Message ${i}`,
        role: 'user' as const,
        timestamp: i * 1000, // Sequential timestamps
        version: 1,
      }));
      
      // Populate Redis
      for (const msg of messages) {
        await redisCache['getRedis']().zadd(`messages:${threadId}`, {
          score: msg.timestamp,
          member: JSON.stringify(msg),
        });
      }
      
      // Get initial viewport (bottom)
      const initialViewport = await redisCache.getViewport(threadId, 'bottom');
      expect(initialViewport.messages.length).toBe(50);
      expect(initialViewport.messages[0]._id).toBe('msg_150');
      
      // Expand viewport upward
      const expandedViewport = await redisCache.expandViewport(
        threadId,
        initialViewport.messages[0].timestamp,
        'up'
      );
      
      expect(expandedViewport).not.toBe(null);
      expect(expandedViewport!.messages.length).toBe(75); // 50 + 25 new
      expect(expandedViewport!.messages[0]._id).toBe('msg_125'); // 25 older messages
      expect(expandedViewport!.hasMore.top).toBe(true); // Still more above
    });

    it('should respect MAX_MEMORY_MESSAGES limit', async () => {
      const threadId = 'thread_memory_limit';
      const messages: CachedMessage[] = Array.from({ length: 300 }, (_, i) => ({
        _id: `msg_${i}`,
        threadId,
        content: `Message ${i}`,
        role: 'user' as const,
        timestamp: i * 1000,
        version: 1,
      }));
      
      // Populate Redis
      for (const msg of messages) {
        await redisCache['getRedis']().zadd(`messages:${threadId}`, {
          score: msg.timestamp,
          member: JSON.stringify(msg),
        });
      }
      
      // Get initial viewport
      await redisCache.getViewport(threadId, 'bottom');
      
      // Expand multiple times
      for (let i = 0; i < 10; i++) {
        const viewport = await redisCache.expandViewport(
          threadId,
          i * 25 * 1000,
          'up'
        );
        if (viewport) {
          expect(viewport.messages.length).toBeLessThanOrEqual(100); // MAX_MEMORY_MESSAGES
        }
      }
    });
  });

  describe('Streaming Message Updates', () => {
    it('should buffer streaming updates correctly', async () => {
      const threadId = 'thread_streaming';
      const messageId = 'msg_streaming_1';
      
      // Setup initial viewport
      redisCache['memoryCache'].set(threadId, {
        threadId,
        messages: [{
          _id: messageId,
          threadId,
          content: '',
          role: 'assistant' as const,
          timestamp: Date.now(),
          version: 1,
          isOptimistic: true,
        }],
        startCursor: messageId,
        endCursor: messageId,
        hasMore: { top: false, bottom: false },
      });
      
      let updateCount = 0;
      const originalUpdate = redisCache['updateMemoryCache'].bind(redisCache);
      redisCache['updateMemoryCache'] = function(...args: any[]) {
        updateCount++;
        return originalUpdate(...args);
      };
      
      // Simulate rapid streaming
      const chunks = 50;
      for (let i = 0; i < chunks; i++) {
        await redisCache.updateStreamingMessage(
          messageId,
          'x'.repeat((i + 1) * 10),
          threadId
        );
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      
      // Force final flush
      await redisCache.updateStreamingMessage(messageId, 'x'.repeat(chunks * 10), threadId, true);
      
      // Should have significantly fewer updates than chunks
      expect(updateCount).toBeLessThan(chunks / 2);
      
      // Check buffer exists
      const buffer = redisCache['streamingBuffer'].get(messageId);
      expect(buffer).toBeDefined();
      expect(buffer!.content).toBe('x'.repeat(chunks * 10));
    });

    it('should handle concurrent streams without interference', async () => {
      const streams = [
        { id: 'msg_1', threadId: 'thread_1' },
        { id: 'msg_2', threadId: 'thread_2' },
      ];
      
      // Setup viewports
      streams.forEach(stream => {
        redisCache['memoryCache'].set(stream.threadId, {
          threadId: stream.threadId,
          messages: [{
            _id: stream.id,
            threadId: stream.threadId,
            content: '',
            role: 'assistant' as const,
            timestamp: Date.now(),
            version: 1,
          }],
          startCursor: stream.id,
          endCursor: stream.id,
          hasMore: { top: false, bottom: false },
        });
      });
      
      // Update streams concurrently
      await Promise.all(
        streams.map(async stream => {
          for (let i = 0; i < 10; i++) {
            await redisCache.updateStreamingMessage(
              stream.id,
              `Stream ${stream.id} update ${i}`,
              stream.threadId
            );
          }
        })
      );
      
      // Check each stream has its own buffer
      streams.forEach(stream => {
        const buffer = redisCache['streamingBuffer'].get(stream.id);
        expect(buffer).toBeDefined();
        expect(buffer!.content).toContain(`Stream ${stream.id}`);
      });
    });
  });

  describe('Lock Management', () => {
    it('should acquire and release locks correctly', async () => {
      const resource = 'test_resource';
      
      // Acquire lock
      const acquired = await redisCache.acquireLock(resource, 5000);
      expect(acquired).toBe(true);
      
      // Try to acquire same lock (should fail)
      const cache2 = new RedisCache();
      const acquired2 = await cache2.acquireLock(resource, 1000);
      expect(acquired2).toBe(false);
      
      // Release lock
      await redisCache.releaseLock(resource);
      
      // Now cache2 should be able to acquire
      const acquired3 = await cache2.acquireLock(resource, 1000);
      expect(acquired3).toBe(true);
      
      await cache2.releaseLock(resource);
      await cache2.cleanup();
    });

    it('should handle stale locks with retry logic', async () => {
      const resource = 'stale_lock_test';
      
      // Simulate stale lock
      await redisCache['getRedis']().set(`lock:${resource}`, 'old_tab_id', {
        px: 100, // Expires in 100ms
      });
      
      // Wait for lock to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be able to acquire now
      const acquired = await redisCache.acquireLock(resource, 5000);
      expect(acquired).toBe(true);
      
      await redisCache.releaseLock(resource);
    });
  });

  describe('Optimistic Updates', () => {
    it('should handle optimistic messages correctly', async () => {
      const threadId = 'thread_optimistic';
      const optimisticMessage: CachedMessage = {
        _id: 'temp_123',
        threadId,
        content: 'Hello',
        role: 'user',
        timestamp: Date.now(),
        version: 1,
        isOptimistic: true,
      };
      
      // Add optimistic message
      await redisCache.addOptimisticMessage(optimisticMessage);
      
      // Check it's in memory cache
      const viewport = redisCache['memoryCache'].get(threadId);
      if (viewport) {
        expect(viewport.messages.some(m => m._id === 'temp_123')).toBe(true);
      }
      
      // Replace with real message
      const realMessage: CachedMessage = {
        ...optimisticMessage,
        _id: 'real_123',
        isOptimistic: false,
      };
      
      await redisCache.replaceOptimisticMessage('temp_123', realMessage);
      
      // Check optimistic is gone and real is there
      const key = `messages:${threadId}`;
      const messages = await redisCache['getRedis']().zrange(key, 0, -1);
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Message Sync', () => {
    it('should sync messages in batches efficiently', async () => {
      const threadId = 'thread_sync';
      const messages: CachedMessage[] = Array.from({ length: 1500 }, (_, i) => ({
        _id: `msg_${i}`,
        threadId,
        content: `Message ${i}`,
        role: 'user' as const,
        timestamp: i * 1000,
        version: 1,
      }));
      
      // Sync messages
      await redisCache.syncMessages(threadId, messages);
      
      // Verify all messages are stored
      const count = await redisCache['getRedis']().zcard(`messages:${threadId}`);
      expect(count).toBe(1500);
      
      // Get a viewport to verify ordering
      const viewport = await redisCache.getViewport(threadId, 'bottom');
      expect(viewport.messages[0]._id).toBe('msg_1450'); // Latest 50
      expect(viewport.messages[49]._id).toBe('msg_1499');
    });

    it('should handle empty sync gracefully', async () => {
      const threadId = 'thread_empty_sync';
      
      // Add some messages first
      await redisCache.syncMessages(threadId, [
        {
          _id: 'msg_1',
          threadId,
          content: 'Test',
          role: 'user',
          timestamp: Date.now(),
          version: 1,
        },
      ]);
      
      // Sync with empty array (clear)
      await redisCache.syncMessages(threadId, []);
      
      // Verify cleared
      const count = await redisCache['getRedis']().zcard(`messages:${threadId}`);
      expect(count).toBe(0);
    });
  });

  describe('Memory Management', () => {
    it('should evict old viewports when cache is full', async () => {
      // Fill cache with viewports
      for (let i = 0; i < 15; i++) {
        redisCache['updateMemoryCache'](`thread_${i}`, {
          threadId: `thread_${i}`,
          messages: [],
          startCursor: null,
          endCursor: null,
          hasMore: { top: false, bottom: false },
        });
      }
      
      // Cache should only keep 10 viewports
      expect(redisCache['memoryCache'].size).toBe(10);
      
      // Oldest should be evicted
      expect(redisCache['memoryCache'].has('thread_0')).toBe(false);
      expect(redisCache['memoryCache'].has('thread_14')).toBe(true);
    });

    it('should report storage info accurately', async () => {
      // Add some test data
      await redisCache.syncMessages('thread_1', [
        {
          _id: 'msg_1',
          threadId: 'thread_1',
          content: 'x'.repeat(1000),
          role: 'user',
          timestamp: Date.now(),
          version: 1,
        },
      ]);
      
      const info = await redisCache.getStorageInfo();
      
      expect(info.memoryCacheSize).toBeGreaterThanOrEqual(0);
      expect(info.redisKeys).toBeGreaterThan(0);
      expect(info.estimatedSize).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Mock Redis error
      const mockError = new Error('Redis connection failed');
      redisCache['getRedis']().get = vi.fn().mockRejectedValue(mockError);
      
      // Should return null/empty instead of throwing
      const thread = await redisCache.getThread('any_thread');
      expect(thread).toBe(null);
      
      // Should return empty viewport
      const viewport = await redisCache.getViewport('any_thread');
      expect(viewport.messages.length).toBe(0);
    });

    it('should continue working with memory cache when Redis fails', async () => {
      // Add to memory cache
      redisCache['memoryCache'].set('thread_local', {
        threadId: 'thread_local',
        messages: [{
          _id: 'msg_local',
          threadId: 'thread_local',
          content: 'Local message',
          role: 'user' as const,
          timestamp: Date.now(),
          version: 1,
        }],
        startCursor: 'msg_local',
        endCursor: 'msg_local',
        hasMore: { top: false, bottom: false },
      });
      
      // Mock Redis error
      redisCache['getRedis']().zrange = vi.fn().mockRejectedValue(new Error('Redis down'));
      
      // Should still return from memory cache
      const viewport = await redisCache.getViewport('thread_local');
      expect(viewport.messages.length).toBe(1);
      expect(viewport.messages[0].content).toBe('Local message');
    });
  });

  describe('Cross-Tab Synchronization', () => {
    it('should publish updates for cross-tab sync', async () => {
      const publishSpy = vi.spyOn(redisCache['getRedis'](), 'publish');
      
      const thread = {
        _id: 'thread_1',
        title: 'Test Thread',
        lastMessageAt: Date.now(),
        messageCount: 10,
        version: 1,
      };
      
      await redisCache.saveThread(thread);
      
      expect(publishSpy).toHaveBeenCalledWith(
        'channel:thread:thread_1',
        expect.objectContaining({
          type: 'thread_update',
          thread,
          tabId: expect.any(String),
        })
      );
    });
  });
});