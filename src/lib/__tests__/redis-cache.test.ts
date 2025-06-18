import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisCache, getRedisCache } from '../redis-cache';

// Mock Redis client
vi.mock('@upstash/redis', () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    zadd: vi.fn(),
    zrange: vi.fn(),
    zcard: vi.fn(),
    zscore: vi.fn(),
    zremrangebyscore: vi.fn(),
    del: vi.fn(),
    expire: vi.fn(),
    keys: vi.fn(),
    dbsize: vi.fn(),
    publish: vi.fn(),
    pipeline: vi.fn(() => ({
      del: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
  };

  return {
    Redis: vi.fn(() => mockRedis),
  };
});

describe('RedisCache', () => {
  let cache: RedisCache;

  beforeEach(() => {
    cache = new RedisCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Thread Operations', () => {
    it('should save and retrieve a thread', async () => {
      const thread = {
        _id: 'thread1',
        title: 'Test Thread',
        lastMessageAt: Date.now(),
        messageCount: 10,
        version: 1,
      };

      await cache.saveThread(thread);
      
      // Verify Redis operations were called
      const { Redis } = await import('@upstash/redis');
      const mockInstance = new Redis({} as any);
      
      expect(mockInstance.setex).toHaveBeenCalledWith(
        'thread:thread1',
        3600,
        thread
      );
      expect(mockInstance.publish).toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      const { Redis } = await import('@upstash/redis');
      const mockInstance = new Redis({} as any);
      
      mockInstance.get = vi.fn().mockRejectedValue(new Error('Redis error'));
      
      const result = await cache.getThread('thread1');
      expect(result).toBeNull();
    });
  });

  describe('Viewport Operations', () => {
    it('should load viewport from bottom by default', async () => {
      const { Redis } = await import('@upstash/redis');
      const mockInstance = new Redis({} as any);
      
      const mockMessages = [
        { _id: 'msg1', content: 'Hello', timestamp: 1 },
        { _id: 'msg2', content: 'World', timestamp: 2 },
      ];
      
      mockInstance.zcard = vi.fn().mockResolvedValue(2);
      mockInstance.zrange = vi.fn().mockResolvedValue(mockMessages);
      
      const viewport = await cache.getViewport('thread1');
      
      expect(viewport.threadId).toBe('thread1');
      expect(viewport.messages).toEqual(mockMessages);
      expect(viewport.startCursor).toBe('msg1');
      expect(viewport.endCursor).toBe('msg2');
    });
  });

  describe('Lock Operations', () => {
    it('should acquire lock successfully', async () => {
      const { Redis } = await import('@upstash/redis');
      const mockInstance = new Redis({} as any);
      
      mockInstance.set = vi.fn().mockResolvedValue('OK');
      
      const acquired = await cache.acquireLock('resource1');
      expect(acquired).toBe(true);
      
      expect(mockInstance.set).toHaveBeenCalledWith(
        'lock:resource1',
        expect.any(String),
        { nx: true, px: 5000 }
      );
    });

    it('should fail to acquire lock if already exists', async () => {
      const { Redis } = await import('@upstash/redis');
      const mockInstance = new Redis({} as any);
      
      mockInstance.set = vi.fn().mockResolvedValue(null);
      
      const acquired = await cache.acquireLock('resource1');
      expect(acquired).toBe(false);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getRedisCache();
      const instance2 = getRedisCache();
      
      expect(instance1).toBe(instance2);
    });
  });
});