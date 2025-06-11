import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, renderHook, act, waitFor } from '@testing-library/react'
import { EnhancedSyncProvider, useEnhancedSync, useThreads, useMessages, useSelectedThread, useSyncStatus } from '../corrected-sync-engine'
import React from 'react'

// Mock the Convex hooks
const mockUseQuery = vi.fn()
const mockUseMutation = vi.fn()
const mockUseAction = vi.fn()

vi.mock('convex/react', () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useAction: mockUseAction,
}))

// Mock the local database
const mockLocalDB = {
  getThreads: vi.fn().mockResolvedValue([]),
  getThread: vi.fn().mockResolvedValue(null),
  saveThread: vi.fn().mockResolvedValue(undefined),
  updateThread: vi.fn().mockResolvedValue(undefined),
  deleteThread: vi.fn().mockResolvedValue(undefined),
  getMessages: vi.fn().mockResolvedValue([]),
  saveMessage: vi.fn().mockResolvedValue(undefined),
  updateMessage: vi.fn().mockResolvedValue(undefined),
  deleteMessage: vi.fn().mockResolvedValue(undefined),
  getMetadata: vi.fn().mockResolvedValue({ version: 1, lastSyncTime: 0, storageType: 'indexeddb' }),
  setMetadata: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
  getSize: vi.fn().mockResolvedValue(0),
  isAvailable: vi.fn().mockResolvedValue(true),
}

vi.mock('../local-db', () => ({
  createLocalDB: vi.fn().mockResolvedValue(mockLocalDB),
}))

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-id-123'),
}))

describe('Enhanced Sync Engine (Corrected Architecture)', () => {
  const mockCreateThread = vi.fn()
  const mockUpdateThread = vi.fn()
  const mockDeleteThread = vi.fn()
  const mockSendMessage = vi.fn()

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Setup default Convex mock returns
    mockUseQuery.mockReturnValue([])
    mockUseMutation.mockImplementation((mutation) => {
      if (mutation.toString().includes('create')) return mockCreateThread
      if (mutation.toString().includes('update')) return mockUpdateThread
      if (mutation.toString().includes('remove')) return mockDeleteThread
      return vi.fn()
    })
    mockUseAction.mockReturnValue(mockSendMessage)
    
    // Reset local DB mocks
    Object.values(mockLocalDB).forEach(mock => {
      if (typeof mock === 'function') mock.mockClear()
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const renderWithProvider = (children: React.ReactNode) => {
    return render(
      <EnhancedSyncProvider>
        {children}
      </EnhancedSyncProvider>
    )
  }

  const renderHookWithProvider = <T,>(hook: () => T) => {
    return renderHook(hook, {
      wrapper: ({ children }) => (
        <EnhancedSyncProvider>
          {children}
        </EnhancedSyncProvider>
      ),
    })
  }

  describe('Initialization', () => {
    it('should initialize with local cache data', async () => {
      const cachedThreads = [{
        _id: 'cached-thread-1',
        title: 'Cached Thread',
        userId: 'user1',
        lastMessageAt: Date.now(),
        syncedToServer: true,
      }]
      
      mockLocalDB.getThreads.mockResolvedValueOnce(cachedThreads)
      
      const { result } = renderHookWithProvider(() => useEnhancedSync())
      
      await waitFor(() => {
        expect(result.current.state.isInitialized).toBe(true)
      })
      
      expect(mockLocalDB.getThreads).toHaveBeenCalled()
      expect(mockLocalDB.getMetadata).toHaveBeenCalled()
    })

    it('should handle initialization errors gracefully', async () => {
      mockLocalDB.getThreads.mockRejectedValueOnce(new Error('Cache failed'))
      
      const { result } = renderHookWithProvider(() => useEnhancedSync())
      
      await waitFor(() => {
        expect(result.current.state.error).toBe('Failed to initialize local cache')
      })
    })
  })

  describe('Convex as Source of Truth', () => {
    it('should sync Convex threads to local cache when Convex data changes', async () => {
      const convexThreads = [{
        _id: 'convex-thread-1',
        title: 'Convex Thread',
        userId: 'user1',
        lastMessageAt: Date.now(),
      }]
      
      mockUseQuery.mockReturnValue(convexThreads)
      
      const { result } = renderHookWithProvider(() => useThreads())
      
      await waitFor(() => {
        expect(mockLocalDB.saveThread).toHaveBeenCalledWith(
          expect.objectContaining({
            _id: 'convex-thread-1',
            title: 'Convex Thread',
            syncedToServer: true,
          })
        )
      })
    })

    it('should prioritize Convex data over local cache', async () => {
      const cachedThreads = [{
        _id: 'thread-1',
        title: 'Cached Title',
        userId: 'user1',
        lastMessageAt: 1000,
        syncedToServer: true,
      }]
      
      const convexThreads = [{
        _id: 'thread-1',
        title: 'Updated from Convex',
        userId: 'user1',
        lastMessageAt: 2000,
      }]
      
      mockLocalDB.getThreads.mockResolvedValue(cachedThreads)
      mockUseQuery.mockReturnValue(convexThreads)
      
      const { result } = renderHookWithProvider(() => useThreads())
      
      await waitFor(() => {
        expect(mockLocalDB.saveThread).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Updated from Convex',
            lastMessageAt: 2000,
          })
        )
      })
    })

    it('should sync Convex messages to local cache', async () => {
      const convexMessages = [{
        _id: 'convex-message-1',
        threadId: 'thread-1',
        role: 'user' as const,
        content: 'Message from Convex',
      }]
      
      // First call returns threads, second call returns messages
      mockUseQuery
        .mockReturnValueOnce([]) // threads
        .mockReturnValueOnce(convexMessages) // messages
      
      const { result } = renderHookWithProvider(() => useEnhancedSync())
      
      // Select a thread to trigger message loading
      await act(async () => {
        await result.current.actions.selectThread('thread-1')
      })
      
      await waitFor(() => {
        expect(mockLocalDB.saveMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            _id: 'convex-message-1',
            content: 'Message from Convex',
            syncedToServer: true,
          })
        )
      })
    })
  })

  describe('Optimistic Updates', () => {
    it('should create optimistic thread before sending to Convex', async () => {
      mockCreateThread.mockResolvedValue('real-thread-id')
      
      const { result } = renderHookWithProvider(() => useEnhancedSync())
      
      await waitFor(() => {
        expect(result.current.state.isInitialized).toBe(true)
      })
      
      let createdThreadId: string
      await act(async () => {
        createdThreadId = await result.current.actions.createThread('Test Thread')
      })
      
      expect(mockCreateThread).toHaveBeenCalledWith({ title: 'Test Thread' })
      expect(createdThreadId!).toBe('real-thread-id')
    })

    it('should remove optimistic thread on creation failure', async () => {
      mockCreateThread.mockRejectedValue(new Error('Creation failed'))
      
      const { result } = renderHookWithProvider(() => useEnhancedSync())
      
      await waitFor(() => {
        expect(result.current.state.isInitialized).toBe(true)
      })
      
      await act(async () => {
        try {
          await result.current.actions.createThread('Test Thread')
        } catch (error) {
          // Expected to throw
        }
      })
      
      // Should have attempted to create on Convex
      expect(mockCreateThread).toHaveBeenCalled()
      
      // Optimistic thread should be removed from state
      expect(result.current.state.threads.find(t => t.isOptimistic)).toBeUndefined()
    })

    it('should create optimistic messages before sending to Convex', async () => {
      const thread = {
        _id: 'thread-1',
        title: 'Test Thread',
        userId: 'user1',
        lastMessageAt: Date.now(),
        provider: 'openai',
        model: 'gpt-4o-mini',
      }
      
      mockLocalDB.getThreads.mockResolvedValue([thread])
      mockSendMessage.mockResolvedValue(undefined)
      
      const { result } = renderHookWithProvider(() => useEnhancedSync())
      
      await waitFor(() => {
        expect(result.current.state.isInitialized).toBe(true)
      })
      
      // Select the thread
      await act(async () => {
        await result.current.actions.selectThread('thread-1')
      })
      
      // Send a message
      await act(async () => {
        await result.current.actions.sendMessage('Hello world', 'thread-1')
      })
      
      expect(mockSendMessage).toHaveBeenCalledWith({
        threadId: 'thread-1',
        content: 'Hello world',
        provider: 'openai',
        model: 'gpt-4o-mini',
      })
    })

    it('should handle message sending failures gracefully', async () => {
      const thread = {
        _id: 'thread-1',
        title: 'Test Thread',
        userId: 'user1',
        lastMessageAt: Date.now(),
        provider: 'openai',
        model: 'gpt-4o-mini',
      }
      
      mockLocalDB.getThreads.mockResolvedValue([thread])
      mockSendMessage.mockRejectedValue(new Error('Send failed'))
      
      const { result } = renderHookWithProvider(() => useEnhancedSync())
      
      await waitFor(() => {
        expect(result.current.state.isInitialized).toBe(true)
      })
      
      await act(async () => {
        await result.current.actions.selectThread('thread-1')
      })
      
      await act(async () => {
        try {
          await result.current.actions.sendMessage('Hello world', 'thread-1')
        } catch (error) {
          // Expected to throw
        }
      })
      
      expect(mockSendMessage).toHaveBeenCalled()
    })
  })

  describe('Thread Management', () => {
    it('should update thread settings on Convex', async () => {
      mockUpdateThread.mockResolvedValue(undefined)
      
      const { result } = renderHookWithProvider(() => useEnhancedSync())
      
      await waitFor(() => {
        expect(result.current.state.isInitialized).toBe(true)
      })
      
      await act(async () => {
        await result.current.actions.updateThread('thread-1', {
          provider: 'anthropic',
          model: 'claude-3-haiku',
        })
      })
      
      expect(mockUpdateThread).toHaveBeenCalledWith({
        threadId: 'thread-1',
        provider: 'anthropic',
        model: 'claude-3-haiku',
      })
    })

    it('should delete thread from Convex and local cache', async () => {
      mockDeleteThread.mockResolvedValue(undefined)
      
      const { result } = renderHookWithProvider(() => useEnhancedSync())
      
      await waitFor(() => {
        expect(result.current.state.isInitialized).toBe(true)
      })
      
      await act(async () => {
        await result.current.actions.deleteThread('thread-1')
      })
      
      expect(mockDeleteThread).toHaveBeenCalledWith({ threadId: 'thread-1' })
      expect(mockLocalDB.deleteThread).toHaveBeenCalledWith('thread-1')
    })
  })

  describe('Convenience Hooks', () => {
    it('useThreads should return current threads', async () => {
      const threads = [{
        _id: 'thread-1',
        title: 'Test Thread',
        userId: 'user1',
        lastMessageAt: Date.now(),
      }]
      
      mockLocalDB.getThreads.mockResolvedValue(threads)
      
      const { result } = renderHookWithProvider(() => useThreads())
      
      await waitFor(() => {
        expect(result.current).toHaveLength(1)
        expect(result.current[0]._id).toBe('thread-1')
      })
    })

    it('useSelectedThread should return selected thread', async () => {
      const thread = {
        _id: 'thread-1',
        title: 'Test Thread',
        userId: 'user1',
        lastMessageAt: Date.now(),
      }
      
      mockLocalDB.getThreads.mockResolvedValue([thread])
      
      const { result: syncResult } = renderHookWithProvider(() => useEnhancedSync())
      const { result: threadResult } = renderHookWithProvider(() => useSelectedThread())
      
      await waitFor(() => {
        expect(syncResult.current.state.isInitialized).toBe(true)
      })
      
      await act(async () => {
        await syncResult.current.actions.selectThread('thread-1')
      })
      
      await waitFor(() => {
        expect(threadResult.current?._id).toBe('thread-1')
      })
    })

    it('useSyncStatus should return sync information', async () => {
      const { result } = renderHookWithProvider(() => useSyncStatus())
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true)
      })
      
      expect(result.current).toEqual(
        expect.objectContaining({
          isInitialized: true,
          pendingOperations: 0,
          hasError: false,
          error: null,
          isSyncing: false,
        })
      )
    })
  })

  describe('Online/Offline Behavior', () => {
    it('should detect online status changes', async () => {
      const { result } = renderHookWithProvider(() => useEnhancedSync())
      
      await waitFor(() => {
        expect(result.current.state.isInitialized).toBe(true)
      })
      
      expect(result.current.state.isOnline).toBe(true)
      
      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      window.dispatchEvent(new Event('offline'))
      
      await waitFor(() => {
        expect(result.current.state.isOnline).toBe(false)
      })
      
      // Simulate coming back online
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      window.dispatchEvent(new Event('online'))
      
      await waitFor(() => {
        expect(result.current.state.isOnline).toBe(true)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle sync errors gracefully', async () => {
      mockLocalDB.saveThread.mockRejectedValue(new Error('Save failed'))
      
      const convexThreads = [{
        _id: 'thread-1',
        title: 'Test Thread',
        userId: 'user1',
        lastMessageAt: Date.now(),
      }]
      
      mockUseQuery.mockReturnValue(convexThreads)
      
      const { result } = renderHookWithProvider(() => useSyncStatus())
      
      await waitFor(() => {
        expect(result.current.hasError).toBe(true)
        expect(result.current.error).toBe('Sync failed')
      })
    })
  })

  describe('Data Consistency', () => {
    it('should merge optimistic and Convex data correctly', async () => {
      const convexThreads = [{
        _id: 'real-thread-1',
        title: 'Real Thread',
        userId: 'user1',
        lastMessageAt: 2000,
      }]
      
      mockUseQuery.mockReturnValue(convexThreads)
      
      const { result } = renderHookWithProvider(() => useEnhancedSync())
      
      await waitFor(() => {
        expect(result.current.state.isInitialized).toBe(true)
      })
      
      // Add optimistic thread
      await act(async () => {
        result.current.actions.createThread('Optimistic Thread')
      })
      
      const threads = result.current.state.threads
      
      // Should have both real and optimistic threads
      expect(threads.some(t => t._id === 'real-thread-1')).toBe(true)
      expect(threads.some(t => t.isOptimistic)).toBe(true)
    })
  })
})
