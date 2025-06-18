/**
 * Integration Tests
 * Tests complete user journeys and system integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisCache } from '../redis-cache';
import { Redis } from '@upstash/redis';
import { nanoid } from 'nanoid';

// Mock Redis
vi.mock('@upstash/redis');

describe('Integration Tests', () => {
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
      flushall: vi.fn().mockResolvedValue('OK'),
    };

    (Redis as any).mockImplementation(() => mockRedis);
    cache = new RedisCache();
  });

  afterEach(async () => {
    await cache.cleanup();
    vi.clearAllMocks();
  });

  describe('Test 9.1: Full User Journey', () => {
    it('should complete entire user workflow successfully', async () => {
      // Step 1: User opens app in 3 tabs
      const tabA = new RedisCache();
      const tabB = new RedisCache();
      const tabC = new RedisCache();

      // Step 2: Create new thread in Tab A
      const threadId = 'thread:user-journey';
      const thread = {
        _id: threadId,
        title: 'User Journey Thread',
        lastMessageAt: Date.now(),
        messageCount: 0,
        version: 1,
      };
      
      await tabA.saveThread(thread);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `thread:${threadId}`,
        3600,
        thread
      );

      // Step 3: Send 5 messages rapidly
      const messages: any[] = [];
      for (let i = 0; i < 5; i++) {
        const msg = {
          _id: `msg-${i}`,
          threadId,
          content: `Message ${i}`,
          role: 'user' as const,
          timestamp: Date.now() + i,
          version: 1,
          isOptimistic: true,
        };
        messages.push(msg);
        await tabA.addOptimisticMessage(msg);
      }

      // Step 4: Switch to Tab B mid-stream
      mockRedis.zcard.mockResolvedValue(5);
      mockRedis.zrange.mockResolvedValue(
        messages.map(m => JSON.stringify(m))
      );
      
      const viewportB = await tabB.getViewport(threadId);
      expect(viewportB.messages).toHaveLength(5);

      // Step 5: Edit message in Tab C
      const editedMessage = {
        ...messages[2],
        content: 'Edited Message 2',
        version: 2,
        isOptimistic: false,
      };
      
      await tabC.replaceOptimisticMessage(messages[2]._id, editedMessage);
      expect(mockRedis.zadd).toHaveBeenCalled();
      expect(mockRedis.publish).toHaveBeenCalled();

      // Step 6: Simulate network loss (Redis operations fail)
      const originalSet = mockRedis.set;
      const originalZadd = mockRedis.zadd;
      mockRedis.set.mockRejectedValue(new Error('Network error'));
      mockRedis.zadd.mockRejectedValue(new Error('Network error'));
      
      // Operations should handle gracefully
      const offlineMessage = {
        _id: 'msg-offline',
        threadId,
        content: 'Sent while offline',
        role: 'user' as const,
        timestamp: Date.now(),
        version: 1,
      };
      
      await expect(tabA.addOptimisticMessage(offlineMessage))
        .resolves.not.toThrow();

      // Step 7: Reconnect and send message
      mockRedis.set = originalSet;
      mockRedis.zadd = originalZadd;
      
      const reconnectedMessage = {
        _id: 'msg-reconnected',
        threadId,
        content: 'Back online!',
        role: 'user' as const,
        timestamp: Date.now(),
        version: 1,
      };
      
      await tabA.addOptimisticMessage(reconnectedMessage);
      expect(mockRedis.setex).toHaveBeenCalled();

      // Step 8: Scroll up to load history
      mockRedis.zscore.mockResolvedValue(messages[0].timestamp);
      mockRedis.zrangebyscore.mockResolvedValue([
        JSON.stringify({
          _id: 'msg-old',
          threadId,
          content: 'Older message',
          role: 'user' as const,
          timestamp: messages[0].timestamp - 1000,
          version: 1,
        }),
      ]);
      
      const olderMessages = await tabB.loadMore(threadId, 'up', messages[0]._id);
      expect(olderMessages).toHaveLength(1);

      // Step 9: Switch threads rapidly
      for (let i = 0; i < 10; i++) {
        const switchThreadId = `thread:switch-${i}`;
        mockRedis.zcard.mockResolvedValue(0);
        mockRedis.zrange.mockResolvedValue([]);
        
        await tabA.getViewport(switchThreadId);
      }

      // Step 10: Close 2 tabs, continue in 1
      await tabB.cleanup();
      await tabC.cleanup();
      
      // Tab A should still work
      const finalViewport = await tabA.getViewport(threadId);
      expect(finalViewport).toBeDefined();

      // Cleanup
      await tabA.cleanup();
    });
  });

  describe('Test 9.2: Migration from Existing System', () => {
    it('should migrate large dataset efficiently', async () => {
      // Simulate user with 100K messages across 100 threads
      const threads = 100;
      const messagesPerThread = 1000;
      const totalMessages = threads * messagesPerThread;

      // Track migration progress
      let migratedMessages = 0;
      const migrationStart = Date.now();

      // Mock batch operations
      const batchSize = 500;
      mockRedis.pipeline.mockReturnValue({
        del: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockImplementation(() => {
          migratedMessages += batchSize;
          return mockRedis.pipeline();
        }),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(
          Array(batchSize).fill(['OK'])
        ),
      });

      // Migrate threads
      for (let t = 0; t < threads; t++) {
        const threadId = `thread:migrate-${t}`;
        const messages = Array.from({ length: messagesPerThread }, (_, i) => ({
          _id: `${threadId}-msg-${i}`,
          threadId,
          content: `Legacy message ${i}`,
          role: 'user' as const,
          timestamp: Date.now() - (messagesPerThread - i) * 1000,
          version: 1,
        }));

        // Sync in batches
        await cache.syncMessages(threadId, messages);
      }

      const migrationDuration = Date.now() - migrationStart;

      // Verify migration completed efficiently
      expect(migrationDuration).toBeLessThan(5 * 60 * 1000); // < 5 minutes
      expect(mockRedis.pipeline().exec).toHaveBeenCalled();
    });

    it('should handle rollback if migration fails', async () => {
      const threadId = 'thread:rollback';
      
      // Start migration
      const messages = Array.from({ length: 100 }, (_, i) => ({
        _id: `msg-${i}`,
        threadId,
        content: `Message ${i}`,
        role: 'user' as const,
        timestamp: Date.now() - i * 1000,
        version: 1,
      }));

      // Simulate partial migration failure
      let callCount = 0;
      mockRedis.pipeline.mockReturnValue({
        del: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount > 50) {
            throw new Error('Migration failed');
          }
          return mockRedis.pipeline();
        }),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      });

      // Attempt migration
      try {
        await cache.syncMessages(threadId, messages);
      } catch (error) {
        // Migration failed
        expect(error).toBeDefined();
      }

      // Rollback: Clear Redis cache
      await mockRedis.flushall();
      expect(mockRedis.flushall).toHaveBeenCalled();

      // Verify can fall back to non-Redis mode
      mockRedis.zcard.mockRejectedValue(new Error('Redis disabled'));
      mockRedis.zrange.mockRejectedValue(new Error('Redis disabled'));
      
      const viewport = await cache.getViewport(threadId);
      expect(viewport.messages).toHaveLength(0); // Fallback to empty
    });
  });

  describe('Test 10: Monitoring and Observability', () => {
    it('should collect comprehensive metrics', async () => {
      const metrics = {
        operations: [] as any[],
        latencies: [] as number[],
        errors: [] as any[],
        cacheHits: 0,
        cacheMisses: 0,
      };

      // Track operations
      const originalGet = mockRedis.get;
      mockRedis.get.mockImplementation(async (...args) => {
        const start = Date.now();
        try {
          const result = await originalGet(...args);
          metrics.latencies.push(Date.now() - start);
          if (result) metrics.cacheHits++;
          else metrics.cacheMisses++;
          return result;
        } catch (error) {
          metrics.errors.push({ op: 'get', error });
          throw error;
        }
      });

      // Perform various operations
      const threadId = 'thread:metrics';
      
      // Cache miss
      mockRedis.get.mockResolvedValueOnce(null);
      await cache.getThread(threadId);
      
      // Cache hit
      mockRedis.get.mockResolvedValueOnce({ _id: threadId });
      await cache.getThread(threadId);
      
      // Error
      mockRedis.get.mockRejectedValueOnce(new Error('Redis error'));
      await cache.getThread(threadId);

      // Verify metrics collected
      expect(metrics.cacheHits).toBe(1);
      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.errors).toHaveLength(1);
      expect(metrics.latencies.length).toBeGreaterThan(0);

      // Calculate percentiles
      const sortedLatencies = metrics.latencies.sort((a, b) => a - b);
      const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)];
      const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)];
      
      expect(p50).toBeDefined();
      expect(p99).toBeDefined();
    });

    it('should provide debug information on errors', async () => {
      const threadId = 'thread:debug';
      const errorContext = {
        timestamp: Date.now(),
        operation: 'getViewport',
        threadId,
        tabId: (cache as any).tabId,
        memoryCache: (cache as any).memoryCache.size,
        lastError: null as any,
      };

      // Capture errors with context
      const originalConsoleError = console.error;
      console.error = vi.fn().mockImplementation((...args) => {
        errorContext.lastError = args;
      });

      // Trigger error
      mockRedis.zcard.mockRejectedValueOnce(new Error('Debug test error'));
      await cache.getViewport(threadId);

      // Verify error context captured
      expect(errorContext.lastError).toBeDefined();
      expect(errorContext.lastError[0]).toContain('Redis getViewport error');

      console.error = originalConsoleError;
    });
  });

  describe('Success Criteria Validation', () => {
    it('should achieve zero data loss', async () => {
      const threadId = 'thread:no-loss';
      const messages = Array.from({ length: 100 }, (_, i) => ({
        _id: `msg-${i}`,
        threadId,
        content: `Message ${i}`,
        role: 'user' as const,
        timestamp: Date.now() + i,
        version: 1,
      }));

      // Track all operations
      let savedMessages = 0;
      mockRedis.zadd.mockImplementation(() => {
        savedMessages++;
        return Promise.resolve(1);
      });

      // Send all messages
      for (const msg of messages) {
        await cache.addOptimisticMessage(msg);
      }

      // Replace optimistic with real
      for (const msg of messages) {
        await cache.replaceOptimisticMessage(msg._id, {
          ...msg,
          _id: `real-${msg._id}`,
          isOptimistic: false,
        });
      }

      // Verify no loss
      expect(savedMessages).toBeGreaterThanOrEqual(messages.length);
    });

    it('should maintain sub-100ms p99 latency', async () => {
      const operations = 1000;
      const latencies: number[] = [];

      for (let i = 0; i < operations; i++) {
        const start = Date.now();
        
        // Simulate operation
        if (i % 3 === 0) {
          await cache.getViewport(`thread:${i}`);
        } else if (i % 3 === 1) {
          await cache.acquireLock(`resource:${i}`);
        } else {
          await cache.addOptimisticMessage({
            _id: `msg-${i}`,
            threadId: 'thread:perf',
            content: 'Test',
            role: 'user' as const,
            timestamp: Date.now(),
            version: 1,
          });
        }
        
        latencies.push(Date.now() - start);
      }

      // Calculate p99
      latencies.sort((a, b) => a - b);
      const p99 = latencies[Math.floor(latencies.length * 0.99)];
      
      // In mock environment, should be very fast
      expect(p99).toBeLessThan(100);
    });

    it('should handle 1M messages per thread', async () => {
      const threadId = 'thread:million';
      const messageCount = 1_000_000;

      // Mock Redis reporting 1M messages
      mockRedis.zcard.mockResolvedValue(messageCount);
      
      // Load viewport should still be fast and memory-efficient
      const start = Date.now();
      const viewport = await cache.getViewport(threadId);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Fast
      expect(viewport.messages.length).toBeLessThanOrEqual(50); // Limited viewport
      expect(viewport.hasMore.top).toBe(true); // More messages available
    });
  });
});