/**
 * Cross-Tab Synchronization Tests
 * Tests Redis pub/sub and cross-tab message synchronization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisCache } from '../redis-cache';
import { Redis } from '@upstash/redis';
import { nanoid } from 'nanoid';

// Mock Redis
vi.mock('@upstash/redis');

describe('Cross-Tab Synchronization', () => {
  let tabA: RedisCache;
  let tabB: RedisCache;
  let tabC: RedisCache;
  let mockRedis: any;

  beforeEach(() => {
    // Create mock Redis instance
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

    // Mock the Redis constructor
    (Redis as any).mockImplementation(() => mockRedis);

    // Create three tab instances
    tabA = new RedisCache();
    tabB = new RedisCache();
    tabC = new RedisCache();
  });

  afterEach(async () => {
    await tabA.cleanup();
    await tabB.cleanup();
    await tabC.cleanup();
    vi.clearAllMocks();
  });

  describe('Test 1.1: Simultaneous Message Send', () => {
    it('should maintain message order across all tabs', async () => {
      const threadId = 'thread:test';
      const messages = [
        {
          _id: nanoid(),
          threadId,
          content: 'Message from A',
          role: 'user' as const,
          timestamp: Date.now(),
          version: 1,
        },
        {
          _id: nanoid(),
          threadId,
          content: 'Message from B',
          role: 'user' as const,
          timestamp: Date.now() + 1,
          version: 1,
        },
        {
          _id: nanoid(),
          threadId,
          content: 'Message from C',
          role: 'user' as const,
          timestamp: Date.now() + 2,
          version: 1,
        },
      ];

      // Mock Redis responses
      mockRedis.zcard.mockResolvedValue(3);
      mockRedis.zrange.mockResolvedValue(
        messages.map(msg => JSON.stringify(msg))
      );

      // Send messages simultaneously
      await Promise.all([
        tabA.addOptimisticMessage(messages[0]),
        tabB.addOptimisticMessage(messages[1]),
        tabC.addOptimisticMessage(messages[2]),
      ]);

      // Verify pub/sub was called for each message
      expect(mockRedis.publish).toHaveBeenCalledTimes(3);
      expect(mockRedis.publish).toHaveBeenCalledWith(
        expect.stringContaining('channel:optimistic'),
        expect.objectContaining({
          type: 'optimistic_message',
          message: messages[0],
        })
      );

      // Load viewport in each tab
      const viewportA = await tabA.getViewport(threadId);
      const viewportB = await tabB.getViewport(threadId);
      const viewportC = await tabC.getViewport(threadId);

      // Verify all tabs show same messages in same order
      expect(viewportA.messages).toHaveLength(3);
      expect(viewportB.messages).toHaveLength(3);
      expect(viewportC.messages).toHaveLength(3);

      // Verify order is consistent
      expect(viewportA.messages.map(m => m.content)).toEqual([
        'Message from A',
        'Message from B',
        'Message from C',
      ]);
      expect(viewportB.messages).toEqual(viewportA.messages);
      expect(viewportC.messages).toEqual(viewportA.messages);
    });
  });

  describe('Test 1.2: Rapid Tab Switching During Stream', () => {
    it('should maintain streaming state across tab switches', async () => {
      const threadId = 'thread:streaming';
      const chunks = ['Hello', ' ', 'world', ' ', 'from', ' ', 'AI'];
      let currentContent = '';

      // Simulate streaming by adding chunks
      for (let i = 0; i < chunks.length; i++) {
        currentContent += chunks[i];
        const message = {
          _id: 'streaming-msg',
          threadId,
          content: currentContent,
          role: 'assistant' as const,
          timestamp: Date.now(),
          version: i + 1,
          isOptimistic: true,
        };

        // Simulate rapid tab switching
        const tab = [tabA, tabB, tabC][i % 3];
        await tab.addOptimisticMessage(message);

        // Mock the viewport response with current state
        mockRedis.zrange.mockResolvedValue([JSON.stringify(message)]);
        mockRedis.zcard.mockResolvedValue(1);
      }

      // Verify all tabs converge to final state
      const finalMessage = {
        _id: 'streaming-msg',
        threadId,
        content: 'Hello world from AI',
        role: 'assistant' as const,
        timestamp: Date.now(),
        version: chunks.length,
      };

      await tabA.replaceOptimisticMessage('streaming-msg', finalMessage);

      // Verify publish was called for final message
      expect(mockRedis.publish).toHaveBeenCalledWith(
        expect.stringContaining(`channel:thread:${threadId}`),
        expect.objectContaining({
          type: 'message_confirmed',
          optimisticId: 'streaming-msg',
          realMessage: finalMessage,
        })
      );
    });
  });

  describe('Test 1.3: Tab Crash Recovery', () => {
    it('should recover from tab crash and release locks', async () => {
      const resource = 'thread:123';
      
      // Tab A acquires lock
      mockRedis.set.mockResolvedValueOnce('OK');
      const lockAcquired = await tabA.acquireLock(resource, 5000);
      expect(lockAcquired).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        `lock:${resource}`,
        expect.any(String),
        { nx: true, px: 5000 }
      );

      // Simulate tab crash (cleanup without releasing lock)
      // In real scenario, lock would expire after TTL
      
      // Tab B tries to acquire same lock immediately (should fail)
      mockRedis.set.mockResolvedValueOnce(null);
      const lockBImmediate = await tabB.acquireLock(resource, 5000);
      expect(lockBImmediate).toBe(false);

      // Simulate TTL expiration
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.set.mockResolvedValueOnce('OK');
      
      // Tab B tries again after TTL (should succeed)
      const lockBAfterTTL = await tabB.acquireLock(resource, 5000);
      expect(lockBAfterTTL).toBe(true);
    });

    it('should recover optimistic messages after crash', async () => {
      const threadId = 'thread:recovery';
      const optimisticMessage = {
        _id: 'opt-123',
        threadId,
        content: 'Message before crash',
        role: 'user' as const,
        timestamp: Date.now(),
        version: 1,
        isOptimistic: true,
      };

      // Tab A sends optimistic message
      await tabA.addOptimisticMessage(optimisticMessage);
      
      // Verify optimistic message was stored
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('optimistic:'),
        60,
        expect.objectContaining({
          message: optimisticMessage,
          timestamp: expect.any(Number),
        })
      );

      // Tab A crashes
      await tabA.cleanup();

      // Tab B can still see the optimistic message via Redis
      mockRedis.get.mockResolvedValueOnce({
        message: optimisticMessage,
        timestamp: Date.now(),
      });

      // Tab C confirms the message
      const confirmedMessage = {
        ...optimisticMessage,
        _id: 'real-123',
        isOptimistic: false,
      };
      
      await tabC.replaceOptimisticMessage('opt-123', confirmedMessage);
      
      // Verify cleanup and notification
      expect(mockRedis.del).toHaveBeenCalled();
      expect(mockRedis.publish).toHaveBeenCalledWith(
        expect.stringContaining(`channel:thread:${threadId}`),
        expect.objectContaining({
          type: 'message_confirmed',
          optimisticId: 'opt-123',
          realMessage: confirmedMessage,
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle Redis publish failures gracefully', async () => {
      mockRedis.publish.mockRejectedValueOnce(new Error('Redis publish failed'));

      const message = {
        _id: nanoid(),
        threadId: 'thread:test',
        content: 'Test message',
        role: 'user' as const,
        timestamp: Date.now(),
        version: 1,
      };

      // Should not throw
      await expect(tabA.addOptimisticMessage(message)).resolves.not.toThrow();
    });

    it('should handle concurrent lock acquisition correctly', async () => {
      const resource = 'thread:concurrent';
      
      // Both tabs try to acquire lock simultaneously
      mockRedis.set
        .mockResolvedValueOnce('OK') // First tab succeeds
        .mockResolvedValueOnce(null); // Second tab fails

      const [lockA, lockB] = await Promise.all([
        tabA.acquireLock(resource),
        tabB.acquireLock(resource),
      ]);

      // Only one should succeed
      expect([lockA, lockB].filter(Boolean)).toHaveLength(1);
    });
  });
});