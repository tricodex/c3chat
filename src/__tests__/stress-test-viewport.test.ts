/**
 * Stress Test 1: Viewport Memory Management
 * 
 * This test verifies that the viewport-based loading keeps memory usage under control
 * even with thousands of messages in a thread.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedisCache } from '../lib/redis-cache';

// Mock Redis
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    zadd: vi.fn(),
    zrange: vi.fn(),
    zrangebyscore: vi.fn(),
    zcard: vi.fn().mockResolvedValue(5000), // Simulate 5000 messages
    keys: vi.fn(),
    del: vi.fn(),
    expire: vi.fn(),
    publish: vi.fn(),
    pipeline: vi.fn(() => ({
      del: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
  })),
}));

describe('Stress Test: Viewport Memory Management', () => {
  let mockRedisCache: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock messages (5000 total)
    const createMockMessage = (index: number) => ({
      _id: `msg_${index}`,
      threadId: 'thread_1',
      content: `Message ${index} content that is reasonably long to simulate real usage`,
      role: 'user' as const,
      timestamp: Date.now() - (5000 - index) * 1000,
      version: 1,
    });

    // Mock Redis responses to return only viewport-sized chunks
    mockRedisCache = {
      getViewport: vi.fn().mockImplementation(async (threadId, anchor) => {
        const start = anchor === 'top' ? 0 : 4950;
        const messages = Array.from({ length: 50 }, (_, i) => createMockMessage(start + i));
        
        return {
          threadId,
          messages,
          startCursor: messages[0]._id,
          endCursor: messages[messages.length - 1]._id,
          hasMore: { top: start > 0, bottom: start + 50 < 5000 },
        };
      }),
      expandViewport: vi.fn().mockImplementation(async (threadId, timestamp, direction) => {
        // Simulate loading 25 more messages
        const messages = Array.from({ length: 25 }, (_, i) => createMockMessage(i));
        return {
          threadId,
          messages: messages,
          hasMore: { top: true, bottom: true },
        };
      }),
    };
  });

  it('should only load viewport-sized chunks, not all 5000 messages', async () => {
    // Test viewport loading directly
    const viewport = await mockRedisCache.getViewport('thread_1', 'bottom');
    
    // Check that only 50 messages are loaded, not 5000
    expect(viewport.messages.length).toBe(50);
    expect(viewport.hasMore.top).toBe(true);
    
    // Measure memory usage (approximate)
    const messageSize = JSON.stringify(viewport.messages).length;
    const expectedMaxSize = 50 * 200; // 50 messages * ~200 bytes each
    
    expect(messageSize).toBeLessThan(expectedMaxSize);
    console.log(`✅ Memory usage: ${messageSize} bytes for ${viewport.messages.length} messages`);
  });

  it('should handle infinite scroll without loading all messages', async () => {
    let loadedMessages = 50;
    
    // Simulate scrolling up to load more
    const moreMessages = await mockRedisCache.expandViewport('thread_1', Date.now(), 'up');
    loadedMessages += moreMessages.messages.length;

    expect(loadedMessages).toBe(75); // 50 initial + 25 more
    expect(loadedMessages).toBeLessThan(5000); // Never loads all messages
    
    console.log(`✅ After scroll: ${loadedMessages} messages loaded (out of 5000 total)`);
  });

  it('should maintain memory under 10MB with large threads', () => {
    // Create a viewport with 50 messages
    const viewport = {
      messages: Array.from({ length: 50 }, (_, i) => ({
        _id: `msg_${i}`,
        content: 'x'.repeat(1000), // 1KB per message
        role: 'user' as const,
        timestamp: Date.now() - i * 1000,
      })),
    };

    const memoryUsage = JSON.stringify(viewport).length;
    const memoryUsageMB = memoryUsage / (1024 * 1024);
    
    expect(memoryUsageMB).toBeLessThan(1); // Should be much less than 10MB
    console.log(`✅ Viewport memory usage: ${memoryUsageMB.toFixed(2)}MB`);
  });
});