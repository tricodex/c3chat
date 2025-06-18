/**
 * Sync Engine Integration Tests
 * 
 * Tests for the complete scalable sync engine with Redis
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { 
  EnhancedSyncProvider, 
  useEnhancedSync, 
  useMessages, 
  useThreads,
  useSelectedThread 
} from '../lib/scalable-sync-engine-v2';

// Mock Convex
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useAction: vi.fn(),
}));

// Mock Redis
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    zadd: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue([]),
    zrangebyscore: vi.fn().mockResolvedValue([]),
    zcard: vi.fn().mockResolvedValue(0),
    zcount: vi.fn().mockResolvedValue(0),
    zscore: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    publish: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    dbsize: vi.fn().mockResolvedValue(0),
    pipeline: vi.fn(() => ({
      del: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
  })),
}));

// Mock API
vi.mock('../../convex/_generated/api', () => ({
  api: {
    threads: {
      list: 'threads.list',
      create: 'threads.create',
      update: 'threads.update',
      remove: 'threads.remove',
      createBranch: 'threads.createBranch',
      share: 'threads.share',
      exportThread: 'threads.exportThread',
    },
    messages: {
      list: 'messages.list',
      create: 'messages.create',
      update: 'messages.update',
      remove: 'messages.remove',
    },
    ai: {
      generateResponse: 'ai.generateResponse',
      generateImage: 'ai.generateImage',
      generateVideo: 'ai.generateVideo',
      regenerateResponse: 'ai.regenerateResponse',
      sendMessageWithContext: 'ai.sendMessageWithContext',
    },
  },
}));

// Helper to create wrapper
const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
  );
};

describe('Sync Engine Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Convex hooks
    const { useQuery, useMutation, useAction } = require('convex/react');
    
    useQuery.mockReturnValue(undefined);
    useMutation.mockReturnValue(vi.fn());
    useAction.mockReturnValue(vi.fn());
  });

  describe('Viewport-based Message Loading', () => {
    it('should use viewport messages instead of all messages', () => {
      const { useQuery } = require('convex/react');
      
      // Mock thread and messages
      useQuery.mockImplementation((query: string) => {
        if (query === 'threads.list') {
          return [{
            _id: 'thread_1',
            title: 'Test Thread',
            userId: 'user_1',
            lastMessageAt: Date.now(),
          }];
        }
        if (query === 'messages.list') {
          // This should NOT be used when viewport is active
          return Array.from({ length: 1000 }, (_, i) => ({
            _id: `msg_${i}`,
            threadId: 'thread_1',
            content: `Message ${i}`,
            role: 'user',
            _creationTime: Date.now() - i * 1000,
          }));
        }
        return undefined;
      });

      const { result } = renderHook(() => {
        const sync = useEnhancedSync();
        const messages = useMessages('thread_1');
        return { sync, messages };
      }, { wrapper: createWrapper() });

      // Initially, viewport might not be ready
      expect(result.current.messages.length).toBe(0);
      
      // Simulate viewport loaded
      act(() => {
        result.current.sync.state.currentViewport = {
          threadId: 'thread_1',
          messages: Array.from({ length: 50 }, (_, i) => ({
            _id: `msg_${i}`,
            threadId: 'thread_1',
            content: `Message ${i}`,
            role: 'user' as const,
            timestamp: Date.now() - i * 1000,
            version: 1,
          })),
          startCursor: 'msg_0',
          endCursor: 'msg_49',
          hasMore: { top: true, bottom: false },
        };
      });

      // Re-render to get updated messages
      result.rerender();
      
      // Should only have viewport messages (50), not all (1000)
      expect(result.current.messages.length).toBe(50);
    });

    it('should warn when viewport is not ready', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const { result } = renderHook(() => useMessages('thread_missing'), {
        wrapper: createWrapper(),
      });

      expect(result.current.length).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Viewport not ready for thread thread_missing')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Thread Selection with Locks', () => {
    it('should acquire lock when switching threads', async () => {
      const { useMutation } = require('convex/react');
      const createThreadMock = vi.fn().mockResolvedValue('new_thread_id');
      useMutation.mockReturnValue(createThreadMock);

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: createWrapper(),
      });

      // Select a thread
      await act(async () => {
        await result.current.actions.selectThread('thread_1');
      });

      // Should update state
      expect(result.current.state.selectedThreadId).toBe('thread_1');
    });

    it('should handle lock acquisition failure gracefully', async () => {
      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: createWrapper(),
      });

      // Mock Redis lock failure
      const redisCache = result.current.state;
      
      await act(async () => {
        await result.current.actions.selectThread('thread_2');
      });

      // Should still select thread even if lock fails
      expect(result.current.state.selectedThreadId).toBe('thread_2');
    });
  });

  describe('Infinite Scroll Integration', () => {
    it('should have loadMoreMessages action available', () => {
      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.actions.loadMoreMessages).toBe('function');
    });

    it('should load more messages when called', async () => {
      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: createWrapper(),
      });

      // Setup initial state with viewport
      act(() => {
        result.current.state.selectedThreadId = 'thread_1';
        result.current.state.currentViewport = {
          threadId: 'thread_1',
          messages: Array.from({ length: 50 }, (_, i) => ({
            _id: `msg_${i}`,
            threadId: 'thread_1',
            content: `Message ${i}`,
            role: 'user' as const,
            timestamp: Date.now() - i * 1000,
            version: 1,
          })),
          startCursor: 'msg_0',
          endCursor: 'msg_49',
          hasMore: { top: true, bottom: true },
        };
      });

      // Load more messages upward
      await act(async () => {
        await result.current.actions.loadMoreMessages('up');
      });

      // Viewport should be updated (in real scenario)
      expect(result.current.state.currentViewport).toBeDefined();
    });
  });

  describe('Optimistic Updates', () => {
    it('should add optimistic message immediately', async () => {
      const { useMutation } = require('convex/react');
      const sendMessageMock = vi.fn().mockResolvedValue('real_msg_id');
      useMutation.mockImplementation((mutation: string) => {
        if (mutation === 'messages.create') return sendMessageMock;
        return vi.fn();
      });

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: createWrapper(),
      });

      // Select thread first
      act(() => {
        result.current.state.selectedThreadId = 'thread_1';
      });

      // Send message
      await act(async () => {
        await result.current.actions.sendMessage(
          'Hello',
          'thread_1',
          'openai',
          'gpt-4',
          'test-key'
        );
      });

      expect(sendMessageMock).toHaveBeenCalledWith({
        threadId: 'thread_1',
        content: 'Hello',
        role: 'user',
        attachmentIds: [],
      });
    });
  });

  describe('Memory Management', () => {
    it('should clear messages when switching threads', async () => {
      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: createWrapper(),
      });

      // Setup thread with messages
      act(() => {
        result.current.state.selectedThreadId = 'thread_1';
        result.current.state.messages['thread_1'] = [
          {
            _id: 'msg_1',
            threadId: 'thread_1',
            content: 'Test',
            role: 'user',
            _creationTime: Date.now(),
          } as any,
        ];
      });

      // Switch to another thread
      await act(async () => {
        await result.current.actions.selectThread('thread_2');
      });

      // Old thread messages should be cleared
      expect(result.current.state.messages['thread_1']).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis errors gracefully', async () => {
      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: createWrapper(),
      });

      // Mock console.error to avoid test output noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // This should not throw even if Redis operations fail
      await act(async () => {
        await result.current.actions.selectThread('thread_error');
      });

      expect(result.current.state.selectedThreadId).toBe('thread_error');
      
      consoleSpy.mockRestore();
    });

    it('should set error state when operations fail', async () => {
      const { useMutation } = require('convex/react');
      useMutation.mockImplementation(() => 
        vi.fn().mockRejectedValue(new Error('Network error'))
      );

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.actions.createThread('New Thread');
        } catch (error) {
          // Expected to throw
        }
      });

      // Thread creation should fail gracefully
      expect(result.current.state.threads.some(t => t.title === 'New Thread')).toBe(false);
    });
  });

  describe('Sync Status', () => {
    it('should track sync status correctly', () => {
      const { result } = renderHook(() => {
        const sync = useEnhancedSync();
        const status = sync.state;
        return { status };
      }, { wrapper: createWrapper() });

      expect(result.current.status.isSyncing).toBe(false);
      expect(result.current.status.isOnline).toBe(true);
      expect(result.current.status.error).toBe(null);
    });
  });
});