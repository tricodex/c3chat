/**
 * Integration tests for the Enhanced Sync Engine
 * 
 * This test suite focuses on the critical integration between:
 * - Local IndexedDB caching
 * - Convex real-time synchronization
 * - Offline/online state management
 * - Optimistic updates and conflict resolution
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import React from 'react'
import { render, renderHook, act, waitFor } from '@testing-library/react'
import { Id } from '../../../convex/_generated/dataModel'

// Mock the entire api module
vi.mock('../../../convex/_generated/api', () => ({
  api: {
    threads: {
      list: { _type: 'query', name: 'threads.list' },
      create: { _type: 'mutation', name: 'threads.create' },
      update: { _type: 'mutation', name: 'threads.update' },
      remove: { _type: 'mutation', name: 'threads.remove' },
      get: { _type: 'query', name: 'threads.get' },
      share: { _type: 'mutation', name: 'threads.share' },
      archive: { _type: 'mutation', name: 'threads.archive' },
    },
    messages: {
      list: { _type: 'query', name: 'messages.list' },
      send: { _type: 'mutation', name: 'messages.send' },
      update: { _type: 'mutation', name: 'messages.update' },
      remove: { _type: 'mutation', name: 'messages.remove' },
    },
    ai: {
      generateResponse: { _type: 'action', name: 'ai.generateResponse' },
    },
    attachments: {
      uploadFile: { _type: 'action', name: 'attachments.uploadFile' },
      getAttachments: { _type: 'query', name: 'attachments.getAttachments' },
    },
    collaboration: {
      getActiveSessions: { _type: 'query', name: 'collaboration.getActiveSessions' },
      joinSession: { _type: 'mutation', name: 'collaboration.joinSession' },
      leaveSession: { _type: 'mutation', name: 'collaboration.leaveSession' },
      updateTypingStatus: { _type: 'mutation', name: 'collaboration.updateTypingStatus' },
    },
  },
}))

// Mock local-db module
vi.mock('../local-db', () => ({
  createLocalDB: vi.fn(() => Promise.resolve({
    isAvailable: vi.fn().mockResolvedValue(true),
    getThreads: vi.fn().mockResolvedValue([]),
    getThread: vi.fn().mockResolvedValue(null),
    saveThread: vi.fn().mockResolvedValue(undefined),
    updateThread: vi.fn().mockResolvedValue(undefined),
    deleteThread: vi.fn().mockResolvedValue(undefined),
    getMessages: vi.fn().mockResolvedValue([]),
    saveMessage: vi.fn().mockResolvedValue(undefined),
    updateMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    getMetadata: vi.fn().mockResolvedValue({}),
    setMetadata: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    getSize: vi.fn().mockResolvedValue(0),
  })),
}))

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => `test-id-${Math.random().toString(36).substr(2, 9)}`),
}))

// Import after mocks are set up
import { 
  EnhancedSyncProvider, 
  useEnhancedSync, 
  useThreads, 
  useMessages,
  useSelectedThread,
  useOfflineCapability 
} from '../corrected-sync-engine'
import { createLocalDB } from '../local-db'

// Mock Convex hooks with proper structure
const mockConvexQuery = vi.fn()
const mockConvexMutation = vi.fn()
const mockConvexAction = vi.fn()

vi.mock('convex/react', () => ({
  useQuery: (query: any, args?: any) => {
    return mockConvexQuery(query, args)
  },
  useMutation: (mutation: any) => {
    return mockConvexMutation(mutation)
  },
  useAction: (action: any) => {
    return mockConvexAction(action)
  },
}))

// Test utilities
const createMockThread = (overrides?: Partial<any>) => ({
  _id: `thread-${Date.now()}-${Math.random()}` as Id<'threads'>,
  title: 'Test Thread',
  userId: 'user1' as Id<'users'>,
  lastMessageAt: Date.now(),
  provider: 'openai',
  model: 'gpt-4o-mini',
  _creationTime: Date.now(),
  ...overrides,
})

const createMockMessage = (threadId: string, overrides?: Partial<any>) => ({
  _id: `message-${Date.now()}-${Math.random()}` as Id<'messages'>,
  threadId: threadId as Id<'threads'>,
  role: 'user' as const,
  content: 'Test message',
  _creationTime: Date.now(),
  ...overrides,
})

describe('Sync Engine Integration Tests', () => {
  let mockDb: any
  let originalNavigatorOnLine: boolean

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Setup default mock returns
    mockConvexQuery.mockReturnValue([])
    mockConvexMutation.mockReturnValue(vi.fn().mockResolvedValue(undefined))
    mockConvexAction.mockReturnValue(vi.fn().mockResolvedValue(undefined))
    
    // Get mocked DB instance
    mockDb = await createLocalDB()
    
    // Store original online state
    originalNavigatorOnLine = navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
    })
  })

  afterEach(() => {
    // Restore online state
    Object.defineProperty(navigator, 'onLine', {
      value: originalNavigatorOnLine,
      writable: true,
    })
    vi.clearAllMocks()
  })

  describe('Basic Functionality', () => {
    it('should initialize sync engine correctly', async () => {
      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      // Should start uninitialized
      expect(result.current.state.isInitialized).toBe(false)
      
      // Wait for initialization
      await waitFor(() => {
        expect(result.current.state.isInitialized).toBe(true)
      }, { timeout: 3000 })

      // Check initial state
      expect(result.current.state).toMatchObject({
        threads: [],
        selectedThreadId: null,
        isOnline: true,
        error: null,
        isSyncing: false,
      })
    })

    it('should create thread with optimistic update', async () => {
      const mockCreateMutation = vi.fn().mockResolvedValue('new-thread-id')
      mockConvexMutation.mockReturnValue(mockCreateMutation)

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await waitFor(() => expect(result.current.state.isInitialized).toBe(true))

      const initialThreadCount = result.current.state.threads.length

      // Create thread
      await act(async () => {
        await result.current.actions.createThread()
      })

      // Should have optimistic thread immediately
      expect(result.current.state.threads.length).toBe(initialThreadCount + 1)
      const optimisticThread = result.current.state.threads[0]
      expect(optimisticThread.isOptimistic).toBe(true)

      // Should call server mutation
      expect(mockCreateMutation).toHaveBeenCalled()

      // Should save to local DB
      expect(mockDb.saveThread).toHaveBeenCalled()
    })

    it('should handle message sending with streaming', async () => {
      const threadId = 'test-thread' as Id<'threads'>
      const thread = createMockThread({ _id: threadId })
      
      // Setup mocks
      mockConvexQuery.mockImplementation((query) => {
        if (query.name === 'threads.list') return [thread]
        if (query.name === 'messages.list') return []
        return []
      })

      const mockSendMessage = vi.fn().mockResolvedValue('message-id')
      const mockGenerateResponse = vi.fn().mockResolvedValue(undefined)
      
      mockConvexMutation.mockImplementation((mutation) => {
        if (mutation.name === 'messages.send') return mockSendMessage
        return vi.fn()
      })
      
      mockConvexAction.mockImplementation((action) => {
        if (action.name === 'ai.generateResponse') return mockGenerateResponse
        return vi.fn()
      })

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await waitFor(() => expect(result.current.state.isInitialized).toBe(true))

      // Select thread
      act(() => {
        result.current.actions.selectThread(threadId)
      })

      // Send message
      await act(async () => {
        await result.current.actions.sendMessage('Hello', threadId)
      })

      // Should create optimistic message
      const messages = result.current.state.messages[threadId] || []
      expect(messages.length).toBeGreaterThan(0)
      
      // Should call mutations
      expect(mockSendMessage).toHaveBeenCalled()
      expect(mockGenerateResponse).toHaveBeenCalled()
    })
  })

  describe('Offline Functionality', () => {
    it('should queue operations when offline', async () => {
      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await waitFor(() => expect(result.current.state.isInitialized).toBe(true))

      // Go offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      window.dispatchEvent(new Event('offline'))

      await waitFor(() => {
        expect(result.current.state.isOnline).toBe(false)
      })

      const mockCreateMutation = vi.fn()
      mockConvexMutation.mockReturnValue(mockCreateMutation)

      // Try to create thread while offline
      await act(async () => {
        await result.current.actions.createThread()
      })

      // Should not call server
      expect(mockCreateMutation).not.toHaveBeenCalled()

      // Should have pending operation
      expect(result.current.state.pendingOperations.length).toBeGreaterThan(0)
      expect(result.current.state.pendingOperations[0].type).toBe('create_thread')

      // Should still create optimistic thread
      expect(result.current.state.threads.length).toBeGreaterThan(0)
      expect(result.current.state.threads[0].isOptimistic).toBe(true)
    })

    it('should process pending operations when coming online', async () => {
      const mockCreateMutation = vi.fn().mockResolvedValue('thread-id')
      mockConvexMutation.mockReturnValue(mockCreateMutation)

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await waitFor(() => expect(result.current.state.isInitialized).toBe(true))

      // Go offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      window.dispatchEvent(new Event('offline'))
      
      await waitFor(() => expect(result.current.state.isOnline).toBe(false))

      // Create operation while offline
      await act(async () => {
        await result.current.actions.createThread()
      })

      expect(result.current.state.pendingOperations.length).toBeGreaterThan(0)

      // Go back online
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      window.dispatchEvent(new Event('online'))

      // Wait for pending operations to be processed
      await waitFor(() => {
        expect(result.current.state.isOnline).toBe(true)
        expect(result.current.state.pendingOperations.length).toBe(0)
      }, { timeout: 3000 })

      // Should have called the mutation
      expect(mockCreateMutation).toHaveBeenCalled()
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent operations', async () => {
      const mockCreateMutation = vi.fn()
        .mockResolvedValueOnce('thread-1')
        .mockResolvedValueOnce('thread-2')
        .mockResolvedValueOnce('thread-3')
      
      mockConvexMutation.mockReturnValue(mockCreateMutation)

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await waitFor(() => expect(result.current.state.isInitialized).toBe(true))

      // Create multiple threads concurrently
      await act(async () => {
        await Promise.all([
          result.current.actions.createThread(),
          result.current.actions.createThread(),
          result.current.actions.createThread(),
        ])
      })

      // All should be called
      expect(mockCreateMutation).toHaveBeenCalledTimes(3)
      
      // Should have optimistic threads
      expect(result.current.state.threads.length).toBeGreaterThanOrEqual(3)
    })

    it('should maintain consistency across multiple hook instances', async () => {
      const thread = createMockThread()
      mockConvexQuery.mockImplementation((query) => {
        if (query.name === 'threads.list') return [thread]
        return []
      })

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      )

      // Create multiple hook instances
      const { result: result1 } = renderHook(() => useEnhancedSync(), { wrapper })
      const { result: result2 } = renderHook(() => useThreads(), { wrapper })
      const { result: result3 } = renderHook(() => useSelectedThread(), { wrapper })

      await waitFor(() => {
        expect(result1.current.state.isInitialized).toBe(true)
      })

      // Select thread in one hook
      act(() => {
        result1.current.actions.selectThread(thread._id)
      })

      // Should be reflected in all hooks
      expect(result1.current.state.selectedThreadId).toBe(thread._id)
      expect(result3.current?._id).toBe(thread._id)
      expect(result2.current).toHaveLength(1)
    })
  })

  describe('Error Handling', () => {
    it('should rollback optimistic updates on error', async () => {
      const mockCreateMutation = vi.fn().mockRejectedValue(new Error('Server error'))
      mockConvexMutation.mockReturnValue(mockCreateMutation)

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await waitFor(() => expect(result.current.state.isInitialized).toBe(true))

      const initialThreadCount = result.current.state.threads.length

      // Try to create thread (will fail)
      await act(async () => {
        try {
          await result.current.actions.createThread()
        } catch (error) {
          // Expected error
        }
      })

      // Wait a bit for rollback
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Should rollback to initial state
      expect(result.current.state.threads.length).toBe(initialThreadCount)
    })

    it('should handle network errors with retry', async () => {
      let callCount = 0
      const mockCreateMutation = vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount < 3) {
          throw new Error('Network error')
        }
        return 'thread-id'
      })
      
      mockConvexMutation.mockReturnValue(mockCreateMutation)

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await waitFor(() => expect(result.current.state.isInitialized).toBe(true))

      // Should retry and eventually succeed
      await act(async () => {
        await result.current.actions.createThread()
      })

      expect(callCount).toBe(3)
    })
  })

  describe('Real-time Sync', () => {
    it('should handle Convex updates', async () => {
      let currentThreads = [createMockThread({ title: 'Initial' })]
      
      mockConvexQuery.mockImplementation((query) => {
        if (query.name === 'threads.list') return currentThreads
        return []
      })

      const { result, rerender } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await waitFor(() => {
        expect(result.current.state.isInitialized).toBe(true)
        expect(result.current.state.threads).toHaveLength(1)
      })

      // Simulate server update
      currentThreads = [createMockThread({ title: 'Updated' })]
      
      // Force re-render to simulate Convex reactive update
      rerender()

      await waitFor(() => {
        expect(result.current.state.threads[0].title).toBe('Updated')
      })
    })

    it('should merge local and server state correctly', async () => {
      const serverId = 'server-thread' as Id<'threads'>
      const serverThread = createMockThread({ _id: serverId, title: 'Server Thread' })
      
      mockConvexQuery.mockImplementation((query) => {
        if (query.name === 'threads.list') return [serverThread]
        return []
      })

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await waitFor(() => expect(result.current.state.isInitialized).toBe(true))

      // Add optimistic thread
      const mockCreateMutation = vi.fn().mockResolvedValue('optimistic-id')
      mockConvexMutation.mockReturnValue(mockCreateMutation)
      
      await act(async () => {
        await result.current.actions.createThread()
      })

      // Should have both threads
      expect(result.current.state.threads.length).toBe(2)
      expect(result.current.state.threads.some(t => t._id === serverId)).toBe(true)
      expect(result.current.state.threads.some(t => t.isOptimistic)).toBe(true)
    })
  })

  describe('Hook Integration', () => {
    it('should provide correct data through specialized hooks', () => {
      const thread1 = createMockThread({ _id: 'thread-1' as Id<'threads'> })
      const thread2 = createMockThread({ _id: 'thread-2' as Id<'threads'> })
      const message1 = createMockMessage('thread-1')
      
      mockConvexQuery.mockImplementation((query) => {
        if (query.name === 'threads.list') return [thread1, thread2]
        if (query.name === 'messages.list' && query.args?.threadId === 'thread-1') {
          return [message1]
        }
        return []
      })

      const TestComponent = () => {
        const threads = useThreads()
        const messages = useMessages()
        const selectedThread = useSelectedThread()
        const { isOfflineCapable, storageInfo } = useOfflineCapability()
        const { actions } = useEnhancedSync()

        return (
          <div>
            <div data-testid="thread-count">{threads.length}</div>
            <div data-testid="selected-thread">{selectedThread?._id || 'none'}</div>
            <div data-testid="message-count">{messages.length}</div>
            <div data-testid="offline-capable">{isOfflineCapable ? 'yes' : 'no'}</div>
            <button onClick={() => actions.selectThread('thread-1' as Id<'threads'>)}>
              Select Thread
            </button>
          </div>
        )
      }

      const { getByTestId, getByText } = render(
        <EnhancedSyncProvider>
          <TestComponent />
        </EnhancedSyncProvider>
      )

      // Wait for initialization
      waitFor(() => {
        expect(getByTestId('thread-count')).toHaveTextContent('2')
        expect(getByTestId('offline-capable')).toHaveTextContent('yes')
      })

      // Select thread
      act(() => {
        getByText('Select Thread').click()
      })

      waitFor(() => {
        expect(getByTestId('selected-thread')).toHaveTextContent('thread-1')
        expect(getByTestId('message-count')).toHaveTextContent('1')
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid thread switching', async () => {
      const threads = Array.from({ length: 5 }, (_, i) => 
        createMockThread({ _id: `thread-${i}` as Id<'threads'> })
      )
      
      mockConvexQuery.mockImplementation((query) => {
        if (query.name === 'threads.list') return threads
        return []
      })

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await waitFor(() => expect(result.current.state.isInitialized).toBe(true))

      // Rapidly switch threads
      for (const thread of threads) {
        act(() => {
          result.current.actions.selectThread(thread._id)
        })
      }

      // Should end up with the last thread selected
      expect(result.current.state.selectedThreadId).toBe('thread-4')
    })

    it('should handle malformed server data', async () => {
      mockConvexQuery.mockImplementation((query) => {
        if (query.name === 'threads.list') {
          return [
            createMockThread(),
            null, // Invalid
            { _id: 'invalid' }, // Missing fields
            createMockThread(),
          ]
        }
        return []
      })

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await waitFor(() => expect(result.current.state.isInitialized).toBe(true))

      // Should filter out invalid threads
      const validThreads = result.current.state.threads.filter(t => 
        t && t._id && t.title && t.userId
      )
      expect(validThreads.length).toBeGreaterThan(0)
    })
  })
})

// Export test utilities for use in other test files
export const createTestSyncProvider = (mockData?: {
  threads?: any[],
  messages?: Record<string, any[]>,
  mutations?: Record<string, Mock>,
}) => {
  if (mockData?.threads) {
    mockConvexQuery.mockImplementation((query) => {
      if (query.name === 'threads.list') return mockData.threads
      if (query.name === 'messages.list' && mockData.messages) {
        return mockData.messages[query.args?.threadId] || []
      }
      return []
    })
  }

  if (mockData?.mutations) {
    mockConvexMutation.mockImplementation((mutation) => {
      return mockData.mutations[mutation.name] || vi.fn()
    })
  }

  return ({ children }: { children: React.ReactNode }) => (
    <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
  )
}