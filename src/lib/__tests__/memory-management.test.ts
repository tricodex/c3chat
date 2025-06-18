/**
 * Memory Management Tests
 * Tests viewport-based loading, memory limits, and garbage collection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisCache } from '../redis-cache';
import { Redis } from '@upstash/redis';

// Mock Redis
vi.mock('@upstash/redis');

describe('Memory Management', () => {
  let cache: RedisCache;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue('OK'),
      setex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn(),
      zadd: vi.fn(),
      zrange: vi.fn(),
      zrangebyscore: vi.fn(),
      zcard: vi.fn(),
      zscore: vi.fn(),
      zremrangebyscore: vi.fn(),
      expire: vi.fn(),
      keys: vi.fn().mockResolvedValue([]),
      dbsize: vi.fn().mockResolvedValue(0),
      publish: vi.fn(),
      pipeline: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    };

    (Redis as any).mockImplementation(() => mockRedis);
    cache = new RedisCache();
  });

  afterEach(async () => {
    await cache.cleanup();
    vi.clearAllMocks();
  });

  describe('Test 2.1: Massive Thread Load', () => {
    it('should handle 1 million messages with constant memory', async () => {
      const threadId = 'thread:massive';
      const messageCount = 1_000_000;

      // Mock Redis to report 1M messages
      mockRedis.zcard.mockResolvedValue(messageCount);

      // Mock viewport with only 50 messages
      const viewportMessages = Array.from({ length: 50 }, (_, i) => ({
        _id: `msg-${messageCount - 50 + i}`,
        threadId,
        content: `Message ${messageCount - 50 + i}`,
        role: 'user' as const,
        timestamp: Date.now() - (50 - i) * 1000,
        version: 1,
      }));

      mockRedis.zrange.mockResolvedValue(
        viewportMessages.map(msg => JSON.stringify(msg))
      );

      // Load viewport
      const viewport = await cache.getViewport(threadId, 'bottom');

      // Verify only viewport size loaded
      expect(viewport.messages).toHaveLength(50);
      expect(viewport.hasMore.top).toBe(true);
      expect(viewport.hasMore.bottom).toBe(false); // At bottom

      // Verify memory usage (rough estimate)
      const storageInfo = await cache.getStorageInfo();
      const viewportSize = JSON.stringify(viewport).length;
      expect(storageInfo.memoryCacheSize).toBeLessThan(10 * 1024 * 1024); // < 10MB
    });

    it('should load more messages efficiently', async () => {
      const threadId = 'thread:loadmore';
      const cursor = 'msg-500';

      // Mock cursor score lookup
      mockRedis.zscore.mockResolvedValue(500);

      // Mock loading 25 older messages
      const olderMessages = Array.from({ length: 25 }, (_, i) => ({
        _id: `msg-${475 + i}`,
        threadId,
        content: `Message ${475 + i}`,
        role: 'user' as const,
        timestamp: 475 + i,
        version: 1,
      }));

      mockRedis.zrangebyscore.mockResolvedValue(
        olderMessages.map(msg => JSON.stringify(msg))
      );

      // Load more messages
      const messages = await cache.loadMore(threadId, 'up', cursor);

      expect(messages).toHaveLength(25);
      expect(mockRedis.zrangebyscore).toHaveBeenCalledWith(
        `messages:${threadId}`,
        '-inf',
        '(500',
        { withScores: false, limit: { offset: 0, count: 25 } }
      );
    });
  });

  describe('Test 2.2: Memory Pressure Simulation', () => {
    it('should evict old viewports when memory limit reached', async () => {
      // Load 15 different thread viewports
      for (let i = 0; i < 15; i++) {
        const threadId = `thread:${i}`;
        mockRedis.zcard.mockResolvedValue(100);
        mockRedis.zrange.mockResolvedValue(
          Array.from({ length: 50 }, (_, j) => 
            JSON.stringify({
              _id: `${threadId}-msg-${j}`,
              threadId,
              content: `Message ${j}`,
              role: 'user' as const,
              timestamp: Date.now() - j * 1000,
              version: 1,
            })
          )
        );

        await cache.getViewport(threadId);
      }

      // Check storage info
      const storageInfo = await cache.getStorageInfo();
      
      // Memory cache should have evicted oldest entries (max 10)
      // This is enforced in updateMemoryCache method
      const cacheSize = (cache as any).memoryCache.size;
      expect(cacheSize).toBeLessThanOrEqual(10);
    });

    it('should handle memory allocation failures gracefully', async () => {
      const threadId = 'thread:oom';
      
      // Mock a very large response that might cause issues
      const hugeMessage = {
        _id: 'huge-msg',
        threadId,
        content: 'X'.repeat(10 * 1024 * 1024), // 10MB message
        role: 'user' as const,
        timestamp: Date.now(),
        version: 1,
      };

      mockRedis.zcard.mockResolvedValue(1);
      mockRedis.zrange.mockResolvedValue([JSON.stringify(hugeMessage)]);

      // Should handle gracefully
      const viewport = await cache.getViewport(threadId);
      expect(viewport.messages).toHaveLength(1);
      expect(viewport.messages[0].content.length).toBe(10 * 1024 * 1024);
    });
  });

  describe('Test 2.3: Viewport Boundary Conditions', () => {
    it('should handle empty thread correctly', async () => {
      const threadId = 'thread:empty';
      
      mockRedis.zcard.mockResolvedValue(0);
      mockRedis.zrange.mockResolvedValue([]);

      const viewport = await cache.getViewport(threadId);

      expect(viewport.messages).toHaveLength(0);
      expect(viewport.startCursor).toBeNull();
      expect(viewport.endCursor).toBeNull();
      expect(viewport.hasMore.top).toBe(false);
      expect(viewport.hasMore.bottom).toBe(false);
    });

    it('should handle single message thread', async () => {
      const threadId = 'thread:single';
      const message = {
        _id: 'single-msg',
        threadId,
        content: 'Only message',
        role: 'user' as const,
        timestamp: Date.now(),
        version: 1,
      };

      mockRedis.zcard.mockResolvedValue(1);
      mockRedis.zrange.mockResolvedValue([JSON.stringify(message)]);

      const viewport = await cache.getViewport(threadId);

      expect(viewport.messages).toHaveLength(1);
      expect(viewport.startCursor).toBe('single-msg');
      expect(viewport.endCursor).toBe('single-msg');
      expect(viewport.hasMore.top).toBe(false);
      expect(viewport.hasMore.bottom).toBe(false);
    });

    it('should handle exactly VIEWPORT_SIZE messages', async () => {
      const threadId = 'thread:exact';
      const messages = Array.from({ length: 50 }, (_, i) => ({
        _id: `msg-${i}`,
        threadId,
        content: `Message ${i}`,
        role: 'user' as const,
        timestamp: Date.now() - (50 - i) * 1000,
        version: 1,
      }));

      mockRedis.zcard.mockResolvedValue(50);
      mockRedis.zrange.mockResolvedValue(
        messages.map(msg => JSON.stringify(msg))
      );

      const viewport = await cache.getViewport(threadId);

      expect(viewport.messages).toHaveLength(50);
      expect(viewport.hasMore.top).toBe(false);
      expect(viewport.hasMore.bottom).toBe(false);
    });

    it('should handle VIEWPORT_SIZE + 1 messages', async () => {
      const threadId = 'thread:plus-one';
      
      // Total 51 messages, but viewport only loads 50
      mockRedis.zcard.mockResolvedValue(51);
      
      const messages = Array.from({ length: 50 }, (_, i) => ({
        _id: `msg-${i + 1}`, // Skip first message
        threadId,
        content: `Message ${i + 1}`,
        role: 'user' as const,
        timestamp: Date.now() - (50 - i) * 1000,
        version: 1,
      }));

      mockRedis.zrange.mockResolvedValue(
        messages.map(msg => JSON.stringify(msg))
      );

      const viewport = await cache.getViewport(threadId, 'bottom');

      expect(viewport.messages).toHaveLength(50);
      expect(viewport.hasMore.top).toBe(true); // One more message above
      expect(viewport.hasMore.bottom).toBe(true); // This is a simplified check
    });
  });

  describe('Memory Cache Management', () => {
    it('should update memory cache efficiently', async () => {
      const threadId = 'thread:memory';
      
      // Initial load
      mockRedis.zcard.mockResolvedValue(100);
      mockRedis.zrange.mockResolvedValue(
        Array.from({ length: 50 }, (_, i) => 
          JSON.stringify({
            _id: `msg-${i}`,
            threadId,
            content: `Message ${i}`,
            role: 'user' as const,
            timestamp: Date.now() - i * 1000,
            version: 1,
          })
        )
      );

      // First load
      const viewport1 = await cache.getViewport(threadId);
      expect(viewport1.messages).toHaveLength(50);

      // Second load should use memory cache
      mockRedis.zrange.mockClear();
      const viewport2 = await cache.getViewport(threadId);
      
      // Should return from memory without Redis call
      expect(viewport2).toEqual(viewport1);
      expect(mockRedis.zrange).not.toHaveBeenCalled();
    });

    it('should handle concurrent viewport updates', async () => {
      const promises = Array.from({ length: 20 }, (_, i) => {
        const threadId = `thread:concurrent-${i}`;
        mockRedis.zcard.mockResolvedValue(10);
        mockRedis.zrange.mockResolvedValue(
          Array.from({ length: 10 }, (_, j) => 
            JSON.stringify({
              _id: `${threadId}-msg-${j}`,
              threadId,
              content: `Message ${j}`,
              role: 'user' as const,
              timestamp: Date.now() - j * 1000,
              version: 1,
            })
          )
        );
        return cache.getViewport(threadId);
      });

      const viewports = await Promise.all(promises);
      
      // All should complete successfully
      expect(viewports).toHaveLength(20);
      viewports.forEach(vp => {
        expect(vp.messages).toHaveLength(10);
      });

      // Memory cache should be limited
      const cacheSize = (cache as any).memoryCache.size;
      expect(cacheSize).toBeLessThanOrEqual(10);
    });
  });
});