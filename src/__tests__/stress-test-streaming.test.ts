/**
 * Stress Test 3: Streaming Performance
 * 
 * This test verifies that streaming messages don't cause excessive re-renders
 * and that the buffering mechanism works correctly.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RedisCache } from '../lib/redis-cache';

// Mock Redis
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    zadd: vi.fn(),
    zrange: vi.fn(),
    zcard: vi.fn(),
    del: vi.fn(),
    publish: vi.fn(),
  })),
}));

describe('Stress Test: Streaming Performance', () => {
  let redisCache: RedisCache;
  let renderCount: number;
  let lastRenderTime: number;
  let renderIntervals: number[];

  beforeEach(() => {
    vi.clearAllMocks();
    redisCache = new RedisCache();
    renderCount = 0;
    lastRenderTime = 0;
    renderIntervals = [];

    // Mock memory cache update to track renders
    const originalUpdateMemoryCache = (redisCache as any).updateMemoryCache;
    (redisCache as any).updateMemoryCache = function(...args: any[]) {
      renderCount++;
      const now = Date.now();
      if (lastRenderTime > 0) {
        renderIntervals.push(now - lastRenderTime);
      }
      lastRenderTime = now;
      return originalUpdateMemoryCache.apply(this, args);
    };

    // Pre-populate memory cache
    (redisCache as any).memoryCache.set('thread_1', {
      threadId: 'thread_1',
      messages: [
        {
          _id: 'msg_streaming',
          threadId: 'thread_1',
          content: '',
          role: 'assistant',
          timestamp: Date.now(),
          version: 1,
          isOptimistic: true,
        },
      ],
      startCursor: 'msg_streaming',
      endCursor: 'msg_streaming',
      hasMore: { top: false, bottom: false },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should buffer streaming updates to reduce re-renders', async () => {
    const messageId = 'msg_streaming';
    const threadId = 'thread_1';
    
    // Simulate rapid streaming updates (100 characters per update)
    const streamContent = async (totalLength: number, chunkSize: number) => {
      let content = '';
      const chunks = Math.ceil(totalLength / chunkSize);
      
      for (let i = 0; i < chunks; i++) {
        content += 'x'.repeat(chunkSize);
        await redisCache.updateStreamingMessage(messageId, content, threadId);
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      
      // Force final flush
      await redisCache.updateStreamingMessage(messageId, content, threadId, true);
    };

    // Stream 10KB of content in 100-byte chunks
    const startTime = Date.now();
    await streamContent(10000, 100);
    const duration = Date.now() - startTime;

    // Should have significantly fewer renders than chunks
    const expectedChunks = 100;
    expect(renderCount).toBeLessThan(expectedChunks / 5); // Less than 20% of chunks cause renders
    
    // Average interval between renders should be at least 100ms
    const avgInterval = renderIntervals.reduce((a, b) => a + b, 0) / renderIntervals.length;
    expect(avgInterval).toBeGreaterThanOrEqual(90); // Allow some variance

    console.log(`✅ Streaming 10KB: ${renderCount} renders (vs ${expectedChunks} chunks)`);
    console.log(`✅ Average render interval: ${avgInterval.toFixed(0)}ms`);
    console.log(`✅ Total duration: ${duration}ms`);
  });

  it('should handle multiple concurrent streams efficiently', async () => {
    const streams = [
      { id: 'msg_1', threadId: 'thread_1' },
      { id: 'msg_2', threadId: 'thread_2' },
      { id: 'msg_3', threadId: 'thread_3' },
    ];

    // Pre-populate caches for all threads
    streams.forEach(stream => {
      (redisCache as any).memoryCache.set(stream.threadId, {
        threadId: stream.threadId,
        messages: [{
          _id: stream.id,
          threadId: stream.threadId,
          content: '',
          role: 'assistant',
          timestamp: Date.now(),
          version: 1,
        }],
        startCursor: stream.id,
        endCursor: stream.id,
        hasMore: { top: false, bottom: false },
      });
    });

    renderCount = 0;
    const updatePromises: Promise<void>[] = [];

    // Start all streams concurrently
    for (const stream of streams) {
      const promise = (async () => {
        let content = '';
        for (let i = 0; i < 50; i++) {
          content += `Stream ${stream.id} chunk ${i}\n`;
          await redisCache.updateStreamingMessage(stream.id, content, stream.threadId);
          await new Promise(resolve => setTimeout(resolve, 30));
        }
        await redisCache.updateStreamingMessage(stream.id, content, stream.threadId, true);
      })();
      updatePromises.push(promise);
    }

    await Promise.all(updatePromises);

    // Total renders should still be reasonable even with concurrent streams
    const maxAcceptableRenders = streams.length * 15; // ~15 renders per stream
    expect(renderCount).toBeLessThan(maxAcceptableRenders);

    console.log(`✅ Concurrent streams: ${renderCount} total renders for ${streams.length} streams`);
    console.log(`✅ Average renders per stream: ${(renderCount / streams.length).toFixed(1)}`);
  });

  it('should clean up streaming buffers after completion', async () => {
    const messageId = 'msg_cleanup';
    const threadId = 'thread_1';

    // Stream some content
    await redisCache.updateStreamingMessage(messageId, 'Hello', threadId);
    
    // Check buffer exists
    expect((redisCache as any).streamingBuffer.has(messageId)).toBe(true);

    // Complete streaming with force flush
    await redisCache.updateStreamingMessage(messageId, 'Hello World!', threadId, true);

    // Wait a bit for any pending timeouts
    await new Promise(resolve => setTimeout(resolve, 150));

    // Buffer should still exist but timeout should be cleared
    const buffer = (redisCache as any).streamingBuffer.get(messageId);
    expect(buffer).toBeDefined();
    expect(buffer.timeoutId).toBeUndefined();

    console.log(`✅ Streaming buffer cleanup successful`);
  });

  it('should maintain good performance with large messages', async () => {
    const messageId = 'msg_large';
    const threadId = 'thread_1';
    
    // Generate a very large message (1MB)
    const largeContent = 'x'.repeat(1024 * 1024);
    
    const startTime = Date.now();
    let chunksSent = 0;
    
    // Stream in 10KB chunks
    for (let i = 0; i < largeContent.length; i += 10240) {
      await redisCache.updateStreamingMessage(
        messageId,
        largeContent.substring(0, i + 10240),
        threadId
      );
      chunksSent++;
      
      // Minimal delay to simulate real streaming
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    
    // Final flush
    await redisCache.updateStreamingMessage(messageId, largeContent, threadId, true);
    
    const duration = Date.now() - startTime;
    const throughputMBps = 1 / (duration / 1000);
    
    // Should handle at least 1MB in under 2 seconds
    expect(duration).toBeLessThan(2000);
    
    // Renders should be minimal despite large content
    expect(renderCount).toBeLessThan(30);
    
    console.log(`✅ Large message (1MB) streamed in ${duration}ms`);
    console.log(`✅ Throughput: ${throughputMBps.toFixed(2)} MB/s`);
    console.log(`✅ Chunks sent: ${chunksSent}, Renders: ${renderCount}`);
  });

  it('should handle edge cases gracefully', async () => {
    const messageId = 'msg_edge';
    const threadId = 'thread_1';

    // Test 1: Empty content
    await redisCache.updateStreamingMessage(messageId, '', threadId);
    expect(renderCount).toBe(1);

    // Test 2: Repeated same content (should still update)
    renderCount = 0;
    for (let i = 0; i < 5; i++) {
      await redisCache.updateStreamingMessage(messageId, 'Same content', threadId);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    expect(renderCount).toBeGreaterThan(0);

    // Test 3: Very rapid updates (faster than buffer interval)
    renderCount = 0;
    for (let i = 0; i < 20; i++) {
      await redisCache.updateStreamingMessage(messageId, `Rapid ${i}`, threadId);
      // No delay - as fast as possible
    }
    // Should have buffered most updates
    expect(renderCount).toBeLessThan(10);

    console.log(`✅ Edge cases handled correctly`);
  });
});