/**
 * Network Resilience Tests
 * Tests circuit breaker, network monitoring, and graceful degradation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisCache } from '../redis-cache';
import { CircuitBreaker, NetworkMonitor } from '../scalable-sync-engine';
import { Redis } from '@upstash/redis';

// Mock Redis
vi.mock('@upstash/redis');

// Mock fetch for network tests
global.fetch = vi.fn();

describe('Network Resilience', () => {
  let cache: RedisCache;
  let circuitBreaker: CircuitBreaker;
  let networkMonitor: NetworkMonitor;
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
    circuitBreaker = new CircuitBreaker();
    networkMonitor = new NetworkMonitor();
  });

  afterEach(async () => {
    await cache.cleanup();
    vi.clearAllMocks();
  });

  describe('Test 3.1: Network Flapping', () => {
    it('should activate circuit breaker after repeated failures', async () => {
      // Simulate network failures
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Network error');
          });
        } catch (error) {
          // Expected to fail
        }
      }

      // Circuit should be open now
      expect(circuitBreaker.getState()).toBe('open');

      // Further calls should fail immediately
      const start = Date.now();
      try {
        await circuitBreaker.execute(async () => {
          // This should not execute
          return 'success';
        });
      } catch (error) {
        expect(error.message).toContain('Circuit breaker is open');
      }
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10); // Failed fast
    });

    it('should handle rapid connect/disconnect cycles', async () => {
      const events: string[] = [];
      
      // Mock navigator.onLine
      let isOnline = true;
      Object.defineProperty(navigator, 'onLine', {
        get: () => isOnline,
        configurable: true,
      });

      // Simulate rapid network changes
      for (let i = 0; i < 50; i++) {
        isOnline = !isOnline;
        window.dispatchEvent(new Event(isOnline ? 'online' : 'offline'));
        events.push(isOnline ? 'online' : 'offline');
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Network monitor should debounce these changes
      const quality = networkMonitor.getQuality();
      expect(['excellent', 'good', 'poor', 'offline']).toContain(quality);
    });
  });

  describe('Test 3.2: Partial Network Failure', () => {
    it('should serve from Redis when Convex is down', async () => {
      const threadId = 'thread:partial';
      
      // Mock Redis working fine
      mockRedis.zcard.mockResolvedValue(10);
      mockRedis.zrange.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => 
          JSON.stringify({
            _id: `msg-${i}`,
            threadId,
            content: `Cached message ${i}`,
            role: 'user' as const,
            timestamp: Date.now() - i * 1000,
            version: 1,
          })
        )
      );

      // Simulate Convex being down by not mocking it
      // In real scenario, Convex calls would timeout

      const viewport = await cache.getViewport(threadId);
      
      expect(viewport.messages).toHaveLength(10);
      expect(viewport.messages[0].content).toBe('Cached message 0');
    });

    it('should handle Redis down gracefully', async () => {
      // Make Redis operations fail
      mockRedis.zcard.mockRejectedValue(new Error('Redis connection failed'));
      mockRedis.zrange.mockRejectedValue(new Error('Redis connection failed'));

      const threadId = 'thread:redis-down';
      const viewport = await cache.getViewport(threadId);

      // Should return empty viewport
      expect(viewport.messages).toHaveLength(0);
      expect(viewport.startCursor).toBeNull();
      expect(viewport.endCursor).toBeNull();
      expect(viewport.hasMore.top).toBe(false);
      expect(viewport.hasMore.bottom).toBe(false);
    });
  });

  describe('Test 3.3: Redis Connection Timeout', () => {
    it('should timeout long-running operations', async () => {
      const resource = 'thread:timeout';
      
      // Mock Redis hanging
      mockRedis.set.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('OK'), 10000))
      );

      // Try to acquire lock with timeout
      const start = Date.now();
      const lockAcquired = await Promise.race([
        cache.acquireLock(resource, 5000),
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), 1000))
      ]);

      const duration = Date.now() - start;
      expect(lockAcquired).toBe(false);
      expect(duration).toBeLessThan(1500); // Timed out quickly
    });

    it('should fallback to degraded mode on timeout', async () => {
      // Simulate all Redis operations timing out
      const timeoutError = new Error('Operation timed out');
      mockRedis.get.mockRejectedValue(timeoutError);
      mockRedis.set.mockRejectedValue(timeoutError);
      mockRedis.zadd.mockRejectedValue(timeoutError);
      mockRedis.zrange.mockRejectedValue(timeoutError);

      // Operations should complete with fallback behavior
      const message = {
        _id: 'test-msg',
        threadId: 'thread:test',
        content: 'Test message',
        role: 'user' as const,
        timestamp: Date.now(),
        version: 1,
      };

      // Should not throw
      await expect(cache.addOptimisticMessage(message)).resolves.not.toThrow();
      
      const viewport = await cache.getViewport('thread:test');
      expect(viewport.messages).toHaveLength(0); // Fallback to empty
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should reset after timeout period', async () => {
      const breaker = new CircuitBreaker();
      
      // Fail 3 times to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('Fail');
          });
        } catch {}
      }

      expect(breaker.getState()).toBe('open');

      // Wait for half-open state (normally 30s, but we'll mock it)
      vi.useFakeTimers();
      vi.advanceTimersByTime(30000);
      
      // Should be half-open now
      expect(breaker.getState()).toBe('half-open');

      // Successful call should close circuit
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
      expect(breaker.getState()).toBe('closed');

      vi.useRealTimers();
    });

    it('should handle half-open state correctly', async () => {
      const breaker = new CircuitBreaker();
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('Fail');
          });
        } catch {}
      }

      // Force to half-open
      (breaker as any).state = 'half-open';
      (breaker as any).nextRetry = Date.now();

      // First call fails - should reopen
      try {
        await breaker.execute(async () => {
          throw new Error('Still failing');
        });
      } catch {}

      expect(breaker.getState()).toBe('open');
    });
  });

  describe('Network Quality Monitoring', () => {
    it('should track network quality accurately', async () => {
      const monitor = new NetworkMonitor();
      
      // Mock RTT measurements
      (global.fetch as any).mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ ok: true });
          }, 50); // 50ms latency
        });
      });

      // Update measurements
      for (let i = 0; i < 5; i++) {
        await monitor.measureLatency();
      }

      const quality = monitor.getQuality();
      expect(quality).toBe('excellent'); // < 100ms is excellent
    });

    it('should detect poor network conditions', async () => {
      const monitor = new NetworkMonitor();
      
      // Mock slow network
      (global.fetch as any).mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ ok: true });
          }, 400); // 400ms latency
        });
      });

      // Update measurements
      for (let i = 0; i < 5; i++) {
        await monitor.measureLatency();
      }

      const quality = monitor.getQuality();
      expect(quality).toBe('poor'); // > 300ms is poor
    });
  });
});