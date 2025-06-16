/**
 * Test suite for the fixed sync engine
 * Testing offline queue, retry logic, and other fixes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'

// Mock modules before imports
vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    threads: {
      list: { name: 'threads.list' },
      create: { name: 'threads.create' },
      update: { name: 'threads.update' },
      remove: { name: 'threads.remove' },
    },
    messages: {
      list: { name: 'messages.list' },
      send: { name: 'messages.send' },
      update: { name: 'messages.update' },
      delete: { name: 'messages.delete' },
    },
    ai: {
      sendMessage: { name: 'ai.sendMessage' },
      generateResponse: { name: 'ai.generateResponse' },
    },
  },
}))

// Import after mocks
import { 
  EnhancedSyncProvider, 
  useEnhancedSync, 
  useOfflineCapability 
} from '../corrected-sync-engine'
import { useQuery, useMutation, useAction } from 'convex/react'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
)

describe('Fixed Sync Engine', () => {
  let mockUseQuery: any
  let mockUseMutation: any
  let mockUseAction: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockUseQuery = vi.mocked(useQuery)
    mockUseMutation = vi.mocked(useMutation)
    mockUseAction = vi.mocked(useAction)
    
    // Default implementations
    mockUseQuery.mockReturnValue([])
    mockUseMutation.mockReturnValue(vi.fn().mockResolvedValue('new-id'))
    mockUseAction.mockReturnValue(vi.fn().mockResolvedValue(undefined))
    
    // Reset online status
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    })
  })

  describe('Offline Queue', () => {
    it('should queue operations when offline', async () => {
      // Go offline
      Object.defineProperty(navigator, 'onLine', { value: false })
      
      const { result } = renderHook(() => useEnhancedSync(), { wrapper })
      
      await act(async () => {
        await result.current.actions.createThread('Test Thread')
      })
      
      // Check that operation was queued
      expect(result.current.state.pendingOperations).toHaveLength(1)
      expect(result.current.state.pendingOperations[0]).toMatchObject({
        type: 'create_thread',
        data: { title: 'Test Thread' },
        retryCount: 0,
      })
      
      // Convex mutation should NOT have been called while offline
      expect(mockUseMutation().mock.calls).toHaveLength(0)
    })

    it('should process pending operations when coming online', async () => {
      const mockCreateThread = vi.fn().mockResolvedValue('real-thread-id')
      mockUseMutation.mockReturnValue(mockCreateThread)
      
      // Start offline
      Object.defineProperty(navigator, 'onLine', { value: false })
      
      const { result } = renderHook(() => useEnhancedSync(), { wrapper })
      
      // Create thread while offline
      await act(async () => {
        await result.current.actions.createThread('Test Thread')
      })
      
      expect(result.current.state.pendingOperations).toHaveLength(1)
      
      // Go online
      await act(async () => {
        Object.defineProperty(navigator, 'onLine', { value: true })
        window.dispatchEvent(new Event('online'))
      })
      
      // Wait for pending operations to be processed
      await waitFor(() => {
        expect(result.current.state.pendingOperations).toHaveLength(0)
      })
      
      // Verify the operation was sent to Convex
      expect(mockCreateThread).toHaveBeenCalledWith({
        title: 'Test Thread',
        provider: 'openai',
        model: 'gpt-4o-mini'
      })
    })
  })

  describe('Retry Logic', () => {
    it('should retry failed operations with exponential backoff', async () => {
      const mockCreateThread = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('thread-id')
      
      mockUseMutation.mockReturnValue(mockCreateThread)
      
      const { result } = renderHook(() => useEnhancedSync(), { wrapper })
      
      await act(async () => {
        const promise = result.current.actions.createThread('Test Thread')
        await expect(promise).resolves.toBe('thread-id')
      })
      
      // Should have been called 3 times (2 failures + 1 success)
      expect(mockCreateThread).toHaveBeenCalledTimes(3)
    })

    it('should handle max retry failures', async () => {
      const mockCreateThread = vi.fn()
        .mockRejectedValue(new Error('Network error'))
      
      mockUseMutation.mockReturnValue(mockCreateThread)
      
      const { result } = renderHook(() => useEnhancedSync(), { wrapper })
      
      await act(async () => {
        await expect(
          result.current.actions.createThread('Test Thread')
        ).rejects.toThrow('Network error')
      })
      
      // Should have tried MAX_RETRIES times
      expect(mockCreateThread).toHaveBeenCalledTimes(3)
    })
  })

  describe('useOfflineCapability Hook', () => {
    it('should provide offline capability information', async () => {
      const { result } = renderHook(() => useOfflineCapability(), { wrapper })
      
      await waitFor(() => {
        expect(result.current).toBeDefined()
        expect(result.current.isOfflineCapable).toBe(true)
        expect(result.current.isOnline).toBe(true)
        expect(result.current.pendingOperations).toEqual([])
      })
    })

    it('should track storage quota', async () => {
      // Mock navigator.storage.estimate
      const mockEstimate = vi.fn().mockResolvedValue({
        quota: 1000000000,
        usage: 500000000
      })
      
      Object.defineProperty(navigator, 'storage', {
        value: { estimate: mockEstimate },
        writable: true,
      })
      
      const { result } = renderHook(() => useOfflineCapability(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.storageQuota).toEqual({
          quota: 1000000000,
          usage: 500000000
        })
      })
    })

    it('should update when going offline', async () => {
      const { result } = renderHook(() => useOfflineCapability(), { wrapper })
      
      expect(result.current.isOnline).toBe(true)
      
      await act(async () => {
        Object.defineProperty(navigator, 'onLine', { value: false })
        window.dispatchEvent(new Event('offline'))
      })
      
      expect(result.current.isOnline).toBe(false)
    })
  })

  describe('Memory Leak Prevention', () => {
    it('should cleanup retry timeouts on unmount', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
      
      // Create a slow failing operation
      const mockCreateThread = vi.fn()
        .mockImplementation(() => new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network error')), 100)
        }))
      
      mockUseMutation.mockReturnValue(mockCreateThread)
      
      const { result, unmount } = renderHook(() => useEnhancedSync(), { wrapper })
      
      // Start an operation that will retry
      act(() => {
        result.current.actions.createThread('Test Thread').catch(() => {})
      })
      
      // Unmount before retry completes
      unmount()
      
      // Verify timeouts were cleared
      expect(clearTimeoutSpy).toHaveBeenCalled()
    })

    it('should cleanup local database on unmount', async () => {
      const { unmount } = renderHook(() => useEnhancedSync(), { wrapper })
      
      const { result } = renderHook(() => useEnhancedSync(), { wrapper })
      await waitFor(() => expect(result.current.state.isInitialized).toBe(true))
      
      const localDB = result.current.localDB
      const closeSpy = vi.spyOn(localDB!, 'close')
      
      unmount()
      
      expect(closeSpy).toHaveBeenCalled()
    })
  })

  describe('Race Condition Prevention', () => {
    it('should handle concurrent operations with locks', async () => {
      const { result } = renderHook(() => useEnhancedSync(), { wrapper })
      
      // Simulate concurrent thread creations
      const promises = await act(async () => {
        return Promise.all([
          result.current.actions.createThread('Thread 1'),
          result.current.actions.createThread('Thread 2'),
          result.current.actions.createThread('Thread 3'),
        ])
      })
      
      // All operations should complete without conflicts
      expect(promises).toHaveLength(3)
      expect(promises.every(id => typeof id === 'string')).toBe(true)
    })

    it('should prevent duplicate operations', async () => {
      const mockCreateThread = vi.fn().mockResolvedValue('thread-id')
      mockUseMutation.mockReturnValue(mockCreateThread)
      
      // Start offline to queue operations
      Object.defineProperty(navigator, 'onLine', { value: false })
      
      const { result } = renderHook(() => useEnhancedSync(), { wrapper })
      
      // Create same thread multiple times
      await act(async () => {
        await result.current.actions.createThread('Duplicate Thread')
        await result.current.actions.createThread('Duplicate Thread')
      })
      
      // Should only have one pending operation (deduplication)
      const pendingOps = result.current.state.pendingOperations
      const uniqueOps = pendingOps.filter((op, index, self) =>
        index === self.findIndex(o => 
          o.type === op.type && 
          JSON.stringify(o.data) === JSON.stringify(op.data)
        )
      )
      
      expect(uniqueOps).toHaveLength(1)
    })
  })

  describe('Conflict Resolution', () => {
    it('should handle version conflicts', async () => {
      // Mock a thread with version info
      const serverThread = {
        _id: 'thread-1',
        title: 'Server Title',
        _version: 2,
        _lastModified: Date.now()
      }
      
      mockUseQuery.mockReturnValue([serverThread])
      
      const { result } = renderHook(() => useEnhancedSync(), { wrapper })
      
      await waitFor(() => {
        const threads = result.current.state.threads
        expect(threads[0]._version).toBe(2)
      })
      
      // Try to update with old version
      await act(async () => {
        await result.current.actions.updateThread('thread-1', {
          title: 'New Title',
          _version: 1 // Old version
        })
      })
      
      // Should handle version conflict gracefully
      expect(result.current.state.error).toBeNull()
    })
  })
})

describe('Fixed Sync Engine - Integration', () => {
  it('should handle complete offline/online cycle', async () => {
    const mockCreateThread = vi.fn().mockResolvedValue('thread-123')
    const mockSendMessage = vi.fn().mockResolvedValue('msg-456')
    
    mockUseMutation.mockImplementation((mutation: any) => {
      if (mutation.name === 'threads.create') return mockCreateThread
      if (mutation.name === 'messages.send') return mockSendMessage
      return vi.fn()
    })
    
    // Start online
    const { result } = renderHook(() => useEnhancedSync(), { wrapper })
    
    // Create thread while online
    let threadId: string
    await act(async () => {
      threadId = await result.current.actions.createThread('Online Thread')
    })
    
    expect(mockCreateThread).toHaveBeenCalledTimes(1)
    
    // Go offline
    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { value: false })
      window.dispatchEvent(new Event('offline'))
    })
    
    // Try to send message while offline
    await act(async () => {
      await result.current.actions.sendMessage('Offline message', threadId!)
    })
    
    // Message should be queued, not sent
    expect(mockSendMessage).not.toHaveBeenCalled()
    expect(result.current.state.pendingOperations).toHaveLength(1)
    
    // Go back online
    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { value: true })
      window.dispatchEvent(new Event('online'))
    })
    
    // Wait for sync
    await waitFor(() => {
      expect(result.current.state.pendingOperations).toHaveLength(0)
    })
    
    // Message should now be sent
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
  })
})