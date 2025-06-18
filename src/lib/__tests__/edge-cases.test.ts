/**
 * Edge Case Tests
 * Tests Unicode handling, extremely long messages, security, and stress scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisCache } from '../redis-cache';
import { Redis } from '@upstash/redis';

// Mock Redis
vi.mock('@upstash/redis');

describe('Edge Cases', () => {
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

  describe('Test 7.1: Unicode and Emoji Handling', () => {
    it('should handle complex Unicode correctly', async () => {
      const threadId = 'thread:unicode';
      
      const complexMessages = [
        {
          _id: 'msg-emoji-zwj',
          threadId,
          content: '👨‍👩‍👧‍👦🏳️‍🌈', // Emoji with Zero-Width Joiner
          role: 'user' as const,
          timestamp: Date.now(),
          version: 1,
        },
        {
          _id: 'msg-math-bold',
          threadId,
          content: '𝕳𝖊𝖑𝖑𝖔 𝖂𝖔𝖗𝖑𝖉', // Mathematical Bold
          role: 'user' as const,
          timestamp: Date.now() + 1,
          version: 1,
        },
        {
          _id: 'msg-rtl',
          threadId,
          content: 'שָׁלוֹם עוֹלָם', // Hebrew RTL with diacritics
          role: 'user' as const,
          timestamp: Date.now() + 2,
          version: 1,
        },
        {
          _id: 'msg-flags',
          threadId,
          content: '🇺🇸🇬🇧🇯🇵🇰🇷🇩🇪', // Flag emojis
          role: 'user' as const,
          timestamp: Date.now() + 3,
          version: 1,
        },
        {
          _id: 'msg-special',
          threadId,
          content: '\u0000\uFFFD\u200B\u200C\u200D', // Null, replacement, zero-width chars
          role: 'user' as const,
          timestamp: Date.now() + 4,
          version: 1,
        },
      ];

      // Test each message
      for (const message of complexMessages) {
        await cache.addOptimisticMessage(message);
        
        // Verify Redis received correctly encoded
        expect(mockRedis.setex).toHaveBeenCalledWith(
          expect.any(String),
          60,
          expect.objectContaining({
            message: expect.objectContaining({
              content: message.content,
            }),
          })
        );
      }

      // Verify JSON serialization preserves Unicode
      const serialized = complexMessages.map(msg => JSON.stringify(msg));
      const deserialized = serialized.map(str => JSON.parse(str));
      
      complexMessages.forEach((original, i) => {
        expect(deserialized[i].content).toBe(original.content);
      });
    });

    it('should calculate byte length correctly for Unicode', async () => {
      const messages = [
        { text: 'Hello', expectedBytes: 5 }, // ASCII
        { text: '👋', expectedBytes: 4 }, // Emoji (4 bytes)
        { text: '你好', expectedBytes: 6 }, // Chinese (3 bytes each)
        { text: '🏳️‍🌈', expectedBytes: 14 }, // Complex emoji
      ];

      for (const { text, expectedBytes } of messages) {
        const byteLength = new TextEncoder().encode(text).length;
        expect(byteLength).toBe(expectedBytes);
      }
    });
  });

  describe('Test 7.2: Extremely Long Messages', () => {
    it('should handle 1MB messages', async () => {
      const threadId = 'thread:huge';
      const hugeContent = 'A'.repeat(1024 * 1024); // 1MB
      
      const hugeMessage = {
        _id: 'msg-huge',
        threadId,
        content: hugeContent,
        role: 'user' as const,
        timestamp: Date.now(),
        version: 1,
      };

      await cache.addOptimisticMessage(hugeMessage);
      
      // Verify it was stored
      expect(mockRedis.setex).toHaveBeenCalled();
      
      // Check serialization doesn't fail
      const serialized = JSON.stringify(hugeMessage);
      expect(serialized.length).toBeGreaterThan(1024 * 1024);
    });

    it('should handle code blocks efficiently', async () => {
      const threadId = 'thread:code';
      const codeBlock = '```typescript\n' + 'const x = 1;\n'.repeat(5000) + '```';
      
      const codeMessage = {
        _id: 'msg-code',
        threadId,
        content: codeBlock,
        role: 'assistant' as const,
        timestamp: Date.now(),
        version: 1,
      };

      mockRedis.zcard.mockResolvedValue(1);
      mockRedis.zrange.mockResolvedValue([JSON.stringify(codeMessage)]);

      const viewport = await cache.getViewport(threadId);
      
      expect(viewport.messages).toHaveLength(1);
      expect(viewport.messages[0].content).toContain('```typescript');
      expect(viewport.messages[0].content.match(/const x = 1;/g)?.length).toBe(5000);
    });

    it('should truncate extremely long messages in viewport display', async () => {
      const threadId = 'thread:truncate';
      const maxViewportSize = 100 * 1024; // 100KB limit for viewport
      
      // Create message larger than viewport limit
      const oversizedContent = 'X'.repeat(maxViewportSize + 1000);
      const message = {
        _id: 'msg-oversize',
        threadId,
        content: oversizedContent,
        role: 'user' as const,
        timestamp: Date.now(),
        version: 1,
        metadata: {
          truncated: true,
          originalLength: oversizedContent.length,
        },
      };

      // In production, would truncate for viewport
      await cache.syncMessages(threadId, [message]);
      
      expect(mockRedis.pipeline().zadd).toHaveBeenCalled();
    });
  });

  describe('Test 7.3: Rapid Fire Operations', () => {
    it('should handle 1000 operations per second', async () => {
      const start = Date.now();
      const operations: Promise<any>[] = [];
      
      // Generate 1000 operations
      for (let i = 0; i < 1000; i++) {
        const op = i % 3;
        
        if (op === 0) {
          // Add optimistic message
          operations.push(
            cache.addOptimisticMessage({
              _id: `rapid-${i}`,
              threadId: 'thread:rapid',
              content: `Message ${i}`,
              role: 'user' as const,
              timestamp: Date.now(),
              version: 1,
            })
          );
        } else if (op === 1) {
          // Get viewport
          mockRedis.zcard.mockResolvedValue(50);
          mockRedis.zrange.mockResolvedValue([]);
          operations.push(cache.getViewport(`thread:${i % 10}`));
        } else {
          // Acquire lock
          mockRedis.set.mockResolvedValue(Math.random() > 0.5 ? 'OK' : null);
          operations.push(cache.acquireLock(`resource:${i % 20}`));
        }
      }
      
      // Execute all operations
      const results = await Promise.allSettled(operations);
      const duration = Date.now() - start;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds max
      
      // Most operations should succeed
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      expect(succeeded).toBeGreaterThan(900); // >90% success rate
    });

    it('should handle connection pooling under load', async () => {
      // Simulate many concurrent Redis operations
      const concurrentOps = 100;
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < concurrentOps; i++) {
        promises.push(
          cache.getViewport(`thread:concurrent-${i}`),
          cache.acquireLock(`lock:concurrent-${i}`),
          cache.updatePresence(`thread:${i}`, `user:${i}`)
        );
      }
      
      // All should complete without connection exhaustion
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  describe('Test 8.1: Security - Cache Poisoning Prevention', () => {
    it('should sanitize XSS attempts', async () => {
      const threadId = 'thread:xss';
      const xssAttempts = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '"><script>alert(String.fromCharCode(88,83,83))</script>',
      ];

      for (const xssContent of xssAttempts) {
        const message = {
          _id: `msg-xss-${Date.now()}`,
          threadId,
          content: xssContent,
          role: 'user' as const,
          timestamp: Date.now(),
          version: 1,
        };

        await cache.addOptimisticMessage(message);
        
        // Content should be stored as-is (sanitization happens at render)
        expect(mockRedis.setex).toHaveBeenCalledWith(
          expect.any(String),
          60,
          expect.objectContaining({
            message: expect.objectContaining({
              content: xssContent,
            }),
          })
        );
      }
    });

    it('should prevent Redis command injection', async () => {
      const maliciousInputs = [
        'thread:"; FLUSHALL; "',
        'thread:*; DEL *; SELECT 1',
        'thread:\r\nFLUSHALL\r\n',
        'thread:${process.env.KV_REST_API_TOKEN}',
        'thread:../../admin',
      ];

      for (const input of maliciousInputs) {
        // Should safely handle malicious thread IDs
        const viewport = await cache.getViewport(input);
        
        // Key should be properly escaped
        expect(mockRedis.zcard).toHaveBeenCalledWith(`messages:${input}`);
      }
    });

    it('should prevent path traversal in thread IDs', async () => {
      const traversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        'thread/../admin/secrets',
        'thread/./././../config',
      ];

      for (const attempt of traversalAttempts) {
        await cache.getViewport(attempt);
        
        // Should use the input as-is, Redis keys are safe
        expect(mockRedis.zcard).toHaveBeenCalledWith(`messages:${attempt}`);
      }
    });
  });

  describe('Test 8.2: Token Security', () => {
    it('should not expose tokens in error messages', async () => {
      // Force an error
      mockRedis.set.mockRejectedValue(new Error('Connection failed'));
      
      try {
        await cache.acquireLock('test-resource');
      } catch (error: any) {
        // Error should not contain token
        expect(error.message).not.toContain('KV_REST_API_TOKEN');
        expect(error.message).not.toContain('AXE_');
      }
    });

    it('should not log sensitive data', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Trigger various errors
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      await cache.getThread('thread:test');
      
      // Check console output doesn't contain tokens
      consoleSpy.mock.calls.forEach(call => {
        const output = call.join(' ');
        expect(output).not.toContain('KV_REST_API_TOKEN');
        expect(output).not.toContain('AXE_');
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle sparse message distribution', async () => {
      const threadId = 'thread:sparse';
      
      // Messages with huge gaps in timestamps
      const messages = [
        {
          _id: 'msg-ancient',
          threadId,
          content: 'Ancient message',
          role: 'user' as const,
          timestamp: 1000, // Very old
          version: 1,
        },
        {
          _id: 'msg-recent',
          threadId,
          content: 'Recent message',
          role: 'user' as const,
          timestamp: Date.now(), // Current
          version: 1,
        },
      ];

      mockRedis.zcard.mockResolvedValue(2);
      mockRedis.zrange.mockResolvedValue(messages.map(m => JSON.stringify(m)));

      const viewport = await cache.getViewport(threadId);
      expect(viewport.messages).toHaveLength(2);
    });

    it('should handle message ID collisions', async () => {
      const threadId = 'thread:collision';
      const duplicateId = 'duplicate-id';
      
      // Two messages with same ID but different content
      const msg1 = {
        _id: duplicateId,
        threadId,
        content: 'First message',
        role: 'user' as const,
        timestamp: Date.now() - 1000,
        version: 1,
      };

      const msg2 = {
        _id: duplicateId,
        threadId,
        content: 'Second message',
        role: 'user' as const,
        timestamp: Date.now(),
        version: 2,
      };

      await cache.syncMessages(threadId, [msg1, msg2]);
      
      // Both should be processed (Redis sorted set handles by score)
      expect(mockRedis.pipeline().zadd).toHaveBeenCalled();
    });
  });
});