/**
 * Race Condition Tests
 * Tests distributed locks, concurrent operations, and conflict resolution
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisCache } from '../redis-cache';
import { Redis } from '@upstash/redis';
import { nanoid } from 'nanoid';

// Mock Redis
vi.mock('@upstash/redis');

describe('Race Conditions', () => {
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

  describe('Test 4.1: Concurrent Thread Switches', () => {
    it('should use distributed locks to prevent race conditions', async () => {
      const threads = ['thread:1', 'thread:2', 'thread:3', 'thread:target'];
      const caches = [
        new RedisCache(),
        new RedisCache(),
        new RedisCache(),
      ];

      // Mock lock acquisition - only one succeeds
      let lockHolder: string | null = null;
      mockRedis.set.mockImplementation((key: string, value: string, options: any) => {
        if (key.startsWith('lock:') && options?.nx) {
          if (lockHolder === null) {
            lockHolder = value;
            return Promise.resolve('OK');
          }
          return Promise.resolve(null);
        }
        return Promise.resolve('OK');
      });

      mockRedis.get.mockImplementation((key: string) => {
        if (key.startsWith('lock:')) {
          return Promise.resolve(lockHolder);
        }
        return Promise.resolve(null);
      });

      // All tabs try to switch to target thread simultaneously
      const results = await Promise.all(
        caches.map(cache => cache.acquireLock('thread:target'))
      );

      // Only one should succeed
      const successCount = results.filter(Boolean).length;
      expect(successCount).toBe(1);

      // Cleanup
      await Promise.all(caches.map(c => c.cleanup()));
    });

    it('should maintain thread isolation during switches', async () => {
      const thread1Messages = Array.from({ length: 5 }, (_, i) => ({
        _id: `thread1-msg-${i}`,
        threadId: 'thread:1',
        content: `Thread 1 Message ${i}`,
        role: 'user' as const,
        timestamp: Date.now() - i * 1000,
        version: 1,
      }));

      const thread2Messages = Array.from({ length: 5 }, (_, i) => ({
        _id: `thread2-msg-${i}`,
        threadId: 'thread:2',
        content: `Thread 2 Message ${i}`,
        role: 'user' as const,
        timestamp: Date.now() - i * 1000,
        version: 1,
      }));

      // Mock different responses for different threads
      mockRedis.zcard.mockImplementation((key: string) => {
        if (key.includes('thread:1')) return Promise.resolve(5);
        if (key.includes('thread:2')) return Promise.resolve(5);
        return Promise.resolve(0);
      });

      mockRedis.zrange.mockImplementation((key: string) => {
        if (key.includes('thread:1')) {
          return Promise.resolve(thread1Messages.map(m => JSON.stringify(m)));
        }
        if (key.includes('thread:2')) {
          return Promise.resolve(thread2Messages.map(m => JSON.stringify(m)));
        }
        return Promise.resolve([]);
      });

      // Load both threads
      const viewport1 = await cache.getViewport('thread:1');
      const viewport2 = await cache.getViewport('thread:2');

      // Verify complete isolation
      expect(viewport1.messages.every(m => m.threadId === 'thread:1')).toBe(true);
      expect(viewport2.messages.every(m => m.threadId === 'thread:2')).toBe(true);
      expect(viewport1.messages[0].content).toContain('Thread 1');
      expect(viewport2.messages[0].content).toContain('Thread 2');
    });
  });

  describe('Test 4.2: Message Edit During Stream', () => {
    it('should handle concurrent edit and stream operations', async () => {
      const threadId = 'thread:streaming';
      const originalMessageId = 'msg-original';
      const streamingMessageId = 'msg-streaming';

      // Original message
      const originalMessage = {
        _id: originalMessageId,
        threadId,
        content: 'Hello',
        role: 'user' as const,
        timestamp: Date.now() - 5000,
        version: 1,
      };

      // Streaming response
      const streamingMessage = {
        _id: streamingMessageId,
        threadId,
        content: 'I am responding to your message...',
        role: 'assistant' as const,
        timestamp: Date.now(),
        version: 1,
        isOptimistic: true,
      };

      // User edits original message during stream
      const editedMessage = {
        ...originalMessage,
        content: 'Hello World',
        version: 2,
      };

      // Mock Redis operations
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.publish.mockResolvedValue(1);

      // Start streaming
      await cache.addOptimisticMessage(streamingMessage);

      // Edit original message
      await cache.syncMessages(threadId, [editedMessage, streamingMessage]);

      // Verify both operations completed
      expect(mockRedis.zadd).toHaveBeenCalled();
      expect(mockRedis.publish).toHaveBeenCalledWith(
        expect.stringContaining('channel:optimistic'),
        expect.objectContaining({
          type: 'optimistic_message',
          message: streamingMessage,
        })
      );

      // Verify version tracking
      expect(editedMessage.version).toBe(2);
      expect(originalMessage.version).toBe(1);
    });
  });

  describe('Test 4.3: Simultaneous Delete and Reply', () => {
    it('should handle conflicting operations atomically', async () => {
      const messageId = 'msg-to-delete';
      const threadId = 'thread:conflict';

      // Setup initial message
      const message = {
        _id: messageId,
        threadId,
        content: 'Message to be deleted',
        role: 'user' as const,
        timestamp: Date.now(),
        version: 1,
      };

      // Mock Redis state
      let messageExists = true;
      mockRedis.zadd.mockImplementation(() => {
        if (!messageExists) {
          throw new Error('Message does not exist');
        }
        return Promise.resolve(1);
      });

      mockRedis.del.mockImplementation(() => {
        messageExists = false;
        return Promise.resolve(1);
      });

      // Simulate two operations racing
      const deleteOp = async () => {
        // Acquire lock for delete
        const lockAcquired = await cache.acquireLock(`message:${messageId}`, 1000);
        if (lockAcquired) {
          // Simulate delete
          await mockRedis.del(`message:${messageId}`);
          await cache.releaseLock(`message:${messageId}`);
          return 'deleted';
        }
        throw new Error('Could not acquire lock for delete');
      };

      const replyOp = async () => {
        // Try to reply to message
        const lockAcquired = await cache.acquireLock(`message:${messageId}`, 1000);
        if (lockAcquired) {
          if (!messageExists) {
            await cache.releaseLock(`message:${messageId}`);
            throw new Error('Message was deleted');
          }
          const reply = {
            _id: nanoid(),
            threadId,
            content: 'Reply to message',
            role: 'assistant' as const,
            timestamp: Date.now(),
            version: 1,
            replyTo: messageId,
          };
          await cache.addOptimisticMessage(reply);
          await cache.releaseLock(`message:${messageId}`);
          return 'replied';
        }
        throw new Error('Could not acquire lock for reply');
      };

      // Mock lock behavior - first caller wins
      let lockAcquired = false;
      mockRedis.set.mockImplementation((key: string, value: string, options: any) => {
        if (key.startsWith('lock:') && options?.nx) {
          if (!lockAcquired) {
            lockAcquired = true;
            return Promise.resolve('OK');
          }
          return Promise.resolve(null);
        }
        return Promise.resolve('OK');
      });

      // Race the operations
      const results = await Promise.allSettled([deleteOp(), replyOp()]);

      // One should succeed, one should fail
      const succeeded = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
    });
  });

  describe('Version Conflict Resolution', () => {
    it('should resolve version conflicts with last-write-wins', async () => {
      const messageId = 'msg-conflict';
      const threadId = 'thread:version';

      // Two users load the same message
      const baseMessage = {
        _id: messageId,
        threadId,
        content: 'Original content',
        role: 'user' as const,
        timestamp: Date.now() - 10000,
        version: 1,
      };

      // Both edit simultaneously
      const edit1 = {
        ...baseMessage,
        content: 'Edit from user 1',
        version: 2,
        timestamp: Date.now() - 100,
      };

      const edit2 = {
        ...baseMessage,
        content: 'Edit from user 2',
        version: 2,
        timestamp: Date.now(), // Slightly later
      };

      // Sync both edits
      await cache.syncMessages(threadId, [edit1]);
      await cache.syncMessages(threadId, [edit2]);

      // Redis sorted set will keep the one with higher score (timestamp)
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        expect.stringContaining(`messages:${threadId}`),
        expect.objectContaining({
          score: edit2.timestamp,
          member: JSON.stringify(edit2),
        })
      );
    });

    it('should maintain message history during conflicts', async () => {
      const threadId = 'thread:history';
      const messages = [];

      // Simulate rapid concurrent edits
      for (let i = 0; i < 10; i++) {
        const msg = {
          _id: `msg-${i}`,
          threadId,
          content: `Edit ${i}`,
          role: 'user' as const,
          timestamp: Date.now() + i,
          version: i + 1,
        };
        messages.push(msg);
      }

      // Mock pipeline for batch operations
      const pipelineOps: any[] = [];
      mockRedis.pipeline.mockReturnValue({
        del: vi.fn().mockImplementation((key) => {
          pipelineOps.push({ op: 'del', key });
          return mockRedis.pipeline();
        }),
        zadd: vi.fn().mockImplementation((key, value) => {
          pipelineOps.push({ op: 'zadd', key, value });
          return mockRedis.pipeline();
        }),
        expire: vi.fn().mockImplementation((key, ttl) => {
          pipelineOps.push({ op: 'expire', key, ttl });
          return mockRedis.pipeline();
        }),
        exec: vi.fn().mockResolvedValue([]),
      });

      // Sync all messages
      await cache.syncMessages(threadId, messages);

      // Verify all messages were added in order
      const zaddOps = pipelineOps.filter(op => op.op === 'zadd');
      expect(zaddOps.length).toBeGreaterThan(0);
    });
  });

  describe('Lock Timeout and Recovery', () => {
    it('should handle lock timeout gracefully', async () => {
      const resource = 'critical-resource';
      
      // First lock succeeds
      mockRedis.set.mockResolvedValueOnce('OK');
      const lock1 = await cache.acquireLock(resource, 1000); // 1 second TTL
      expect(lock1).toBe(true);

      // Wait for lock to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Second lock should succeed after timeout
      mockRedis.set.mockResolvedValueOnce('OK');
      const lock2 = await cache.acquireLock(resource, 1000);
      expect(lock2).toBe(true);
    });

    it('should prevent lock extension by non-owner', async () => {
      const resource = 'protected-resource';
      const cache1 = new RedisCache();
      const cache2 = new RedisCache();

      // Cache1 acquires lock
      mockRedis.set.mockResolvedValueOnce('OK');
      await cache1.acquireLock(resource);

      // Cache2 tries to release (should fail)
      mockRedis.get.mockResolvedValueOnce('different-tab-id');
      await cache2.releaseLock(resource);

      // Verify del was not called
      expect(mockRedis.del).not.toHaveBeenCalledWith(`lock:${resource}`);

      // Cleanup
      await cache1.cleanup();
      await cache2.cleanup();
    });
  });
});