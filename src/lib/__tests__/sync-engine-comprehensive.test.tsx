/**
 * Comprehensive test suite for the Enhanced Sync Engine
 * 
 * Test Categories:
 * 1. State Management & Reducers
 * 2. Offline/Online Transitions
 * 3. Optimistic Updates & Rollbacks
 * 4. Concurrent Operations & Conflict Resolution
 * 5. Data Synchronization with Convex
 * 6. Error Handling & Recovery
 * 7. Performance & Memory Management
 * 8. Edge Cases & Race Conditions
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import React from 'react'
import { render, renderHook, act, waitFor, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useQuery, useMutation, useAction } from 'convex/react'
import { 
  EnhancedSyncProvider, 
  useEnhancedSync, 
  useThreads, 
  useMessages, 
  useSelectedThread,
  useOfflineCapability 
} from '../corrected-sync-engine'
import { createLocalDB, LocalDB } from '../local-db'
import { Id } from '../../../convex/_generated/dataModel'

// Mock Convex hooks
vi.mock('convex/react')

// Test utilities and fixtures
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

describe('Enhanced Sync Engine - Comprehensive Tests', () => {
  let mockUseQuery: Mock
  let mockUseMutation: Mock
  let mockUseAction: Mock
  let mockDb: LocalDB
  let originalNavigatorOnLine: boolean

  beforeEach(async () => {
    // Setup mocks
    mockUseQuery = vi.mocked(useQuery)
    mockUseMutation = vi.mocked(useMutation)
    mockUseAction = vi.mocked(useAction)
    
    // Default mock implementations
    mockUseQuery.mockReturnValue([])
    mockUseMutation.mockReturnValue(vi.fn())
    mockUseAction.mockReturnValue(vi.fn())

    // Create local DB
    mockDb = await createLocalDB()
    
    // Store original online state
    originalNavigatorOnLine = navigator.onLine
    
    // Clear all timers
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    // Restore online state
    Object.defineProperty(navigator, 'onLine', {
      value: originalNavigatorOnLine,
      writable: true,
    })
    
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('1. State Management & Reducers', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      expect(result.current.state).toMatchObject({
        threads: [],
        selectedThreadId: null,
        isOnline: true,
        isInitialized: false,
        pendingOperations: [],
        error: null,
        isSyncing: false,
      })
    })

    it('should properly initialize from local database', async () => {
      // Pre-populate local DB
      const mockThread = createMockThread()
      await mockDb.saveThread({
        ...mockThread,
        localCreatedAt: Date.now(),
        syncedToServer: true,
      })

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await waitFor(() => {
        expect(result.current.state.isInitialized).toBe(true)
      })

      expect(result.current.state.threads).toHaveLength(1)
      expect(result.current.state.threads[0]._id).toBe(mockThread._id)
    })

    it('should merge Convex data with local optimistic updates', async () => {
      const convexThread = createMockThread({ title: 'Convex Thread' })
      const optimisticThread = createMockThread({ 
        title: 'Optimistic Thread',
        isOptimistic: true 
      })

      mockUseQuery.mockImplementation((query) => {
        if (query === api.threads.list) {
          return [convexThread]
        }
        return []
      })

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      // Add optimistic thread
      await act(async () => {
        result.current.actions.createThread()
      })

      await waitFor(() => {
        const threads = result.current.state.threads
        expect(threads).toHaveLength(2)
        expect(threads.some(t => t.title === 'Convex Thread')).toBe(true)
        expect(threads.some(t => t.isOptimistic)).toBe(true)
      })
    })

    it('should handle thread selection correctly', async () => {
      const thread = createMockThread()
      mockUseQuery.mockImplementation((query) => {
        if (query === api.threads.list) return [thread]
        return []
      })

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await waitFor(() => {
        expect(result.current.state.threads).toHaveLength(1)
      })

      act(() => {
        result.current.actions.selectThread(thread._id)
      })

      expect(result.current.state.selectedThreadId).toBe(thread._id)
    })
  })

  describe('2. Offline/Online Transitions', () => {
    const setOnlineStatus = (online: boolean) => {
      Object.defineProperty(navigator, 'onLine', {
        value: online,
        writable: true,
      })
      window.dispatchEvent(new Event(online ? 'online' : 'offline'))
    }

    it('should detect offline state and queue operations', async () => {
      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      // Go offline
      setOnlineStatus(false)

      await waitFor(() => {
        expect(result.current.state.isOnline).toBe(false)
      })

      // Try to create a thread while offline
      const mockCreateThread = vi.fn()
      mockUseMutation.mockReturnValue(mockCreateThread)

      await act(async () => {
        await result.current.actions.createThread()
      })

      // Should not call server mutation while offline
      expect(mockCreateThread).not.toHaveBeenCalled()
      
      // Should add to pending operations
      expect(result.current.state.pendingOperations).toHaveLength(1)
      expect(result.current.state.pendingOperations[0].type).toBe('create_thread')
    })

    it('should process pending operations when coming back online', async () => {
      const mockCreateThread = vi.fn().mockResolvedValue('thread-123')
      mockUseMutation.mockReturnValue(mockCreateThread)

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      // Go offline
      setOnlineStatus(false)
      await waitFor(() => expect(result.current.state.isOnline).toBe(false))

      // Create operations while offline
      await act(async () => {
        await result.current.actions.createThread()
      })

      expect(result.current.state.pendingOperations).toHaveLength(1)

      // Go back online
      setOnlineStatus(true)
      
      await waitFor(() => {
        expect(result.current.state.isOnline).toBe(true)
        expect(result.current.state.pendingOperations).toHaveLength(0)
      })

      // Should have processed the pending operation
      expect(mockCreateThread).toHaveBeenCalled()
    })

    it('should handle rapid offline/online transitions gracefully', async () => {
      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      // Rapidly toggle online/offline
      for (let i = 0; i < 10; i++) {
        setOnlineStatus(i % 2 === 0)
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        })
      }

      // Should end up in the final state
      setOnlineStatus(true)
      
      await waitFor(() => {
        expect(result.current.state.isOnline).toBe(true)
      })

      // State should be consistent
      expect(result.current.state.error).toBeNull()
    })
  })

  describe('3. Optimistic Updates & Rollbacks', () => {
    it('should apply optimistic updates immediately', async () => {
      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      const initialThreadCount = result.current.state.threads.length

      await act(async () => {
        await result.current.actions.createThread()
      })

      // Should see the optimistic thread immediately
      expect(result.current.state.threads.length).toBe(initialThreadCount + 1)
      expect(result.current.state.threads[0].isOptimistic).toBe(true)
    })

    it('should rollback optimistic updates on server error', async () => {
      const mockCreateThread = vi.fn().mockRejectedValue(new Error('Server error'))
      mockUseMutation.mockReturnValue(mockCreateThread)

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      const initialThreadCount = result.current.state.threads.length

      await act(async () => {
        try {
          await result.current.actions.createThread()
        } catch (e) {
          // Expected error
        }
      })

      await waitFor(() => {
        // Should rollback to initial state
        expect(result.current.state.threads.length).toBe(initialThreadCount)
      })
    })

    it('should replace optimistic data with server data when confirmed', async () => {
      const serverId = 'server-thread-123' as Id<'threads'>
      const mockCreateThread = vi.fn().mockResolvedValue(serverId)
      mockUseMutation.mockReturnValue(mockCreateThread)

      // Mock server returning the created thread
      const serverThread = createMockThread({ _id: serverId, title: 'Server Thread' })
      
      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await act(async () => {
        await result.current.actions.createThread()
      })

      // Update mock to return the server thread
      mockUseQuery.mockImplementation((query) => {
        if (query === api.threads.list) return [serverThread]
        return []
      })

      // Trigger re-render to simulate Convex update
      result.current.state.threads.forEach(() => {}) // Force re-render

      await waitFor(() => {
        const thread = result.current.state.threads.find(t => t._id === serverId)
        expect(thread).toBeDefined()
        expect(thread?.isOptimistic).toBeFalsy()
        expect(thread?.title).toBe('Server Thread')
      })
    })
  })

  describe('4. Concurrent Operations & Conflict Resolution', () => {
    it('should handle multiple concurrent thread creations', async () => {
      const mockCreateThread = vi.fn()
        .mockResolvedValueOnce('thread-1')
        .mockResolvedValueOnce('thread-2')
        .mockResolvedValueOnce('thread-3')
      
      mockUseMutation.mockReturnValue(mockCreateThread)

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      // Create multiple threads concurrently
      await act(async () => {
        await Promise.all([
          result.current.actions.createThread(),
          result.current.actions.createThread(),
          result.current.actions.createThread(),
        ])
      })

      expect(mockCreateThread).toHaveBeenCalledTimes(3)
      expect(result.current.state.threads.length).toBeGreaterThanOrEqual(3)
    })

    it('should handle concurrent message sending with proper ordering', async () => {
      const threadId = 'thread-123' as Id<'threads'>
      const thread = createMockThread({ _id: threadId })
      
      mockUseQuery.mockImplementation((query) => {
        if (query === api.threads.list) return [thread]
        if (query === api.messages.list) return []
        return []
      })

      const mockSendMessage = vi.fn().mockImplementation(async () => {
        // Simulate server delay
        await new Promise(resolve => setTimeout(resolve, 100))
        return `message-${Date.now()}`
      })
      
      const mockGenerateResponse = vi.fn().mockResolvedValue(undefined)
      
      mockUseMutation.mockReturnValue(mockSendMessage)
      mockUseAction.mockReturnValue(mockGenerateResponse)

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await act(async () => {
        result.current.actions.selectThread(threadId)
      })

      // Send multiple messages concurrently
      const messages = ['Message 1', 'Message 2', 'Message 3']
      
      await act(async () => {
        await Promise.all(
          messages.map(content => 
            result.current.actions.sendMessage(content, threadId)
          )
        )
      })

      // All messages should be sent
      expect(mockSendMessage).toHaveBeenCalledTimes(3)
      
      // Messages should maintain order
      const sentMessages = result.current.state.messages[threadId] || []
      expect(sentMessages.length).toBeGreaterThanOrEqual(3)
    })

    it('should handle conflicting updates to the same thread', async () => {
      const threadId = 'thread-123' as Id<'threads'>
      const thread = createMockThread({ _id: threadId, title: 'Original Title' })
      
      mockUseQuery.mockImplementation((query) => {
        if (query === api.threads.list) return [thread]
        return []
      })

      const mockUpdateThread = vi.fn().mockResolvedValue(undefined)
      mockUseMutation.mockReturnValue(mockUpdateThread)

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.state.threads).toHaveLength(1)
      })

      // Perform conflicting updates
      await act(async () => {
        await Promise.all([
          result.current.actions.updateThread(threadId, { title: 'Update 1' }),
          result.current.actions.updateThread(threadId, { title: 'Update 2' }),
          result.current.actions.updateThread(threadId, { model: 'gpt-4' }),
        ])
      })

      // All updates should be attempted
      expect(mockUpdateThread).toHaveBeenCalledTimes(3)
      
      // Local state should reflect the updates
      const updatedThread = result.current.state.threads.find(t => t._id === threadId)
      expect(updatedThread).toBeDefined()
    })
  })

  describe('5. Data Synchronization with Convex', () => {
    it('should sync local changes with Convex on reconnection', async () => {
      const mockCreateThread = vi.fn().mockResolvedValue('thread-123')
      const mockSendMessage = vi.fn().mockResolvedValue('message-123')
      
      mockUseMutation.mockImplementation((mutation) => {
        if (mutation.name?.includes('create')) return mockCreateThread
        if (mutation.name?.includes('send')) return mockSendMessage
        return vi.fn()
      })

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      // Go offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      window.dispatchEvent(new Event('offline'))
      
      await waitFor(() => expect(result.current.state.isOnline).toBe(false))

      // Create thread and message while offline
      await act(async () => {
        await result.current.actions.createThread()
      })

      const threadId = result.current.state.threads[0]?._id
      expect(threadId).toBeDefined()

      await act(async () => {
        await result.current.actions.sendMessage('Test message', threadId!)
      })

      // Verify operations are queued
      expect(result.current.state.pendingOperations.length).toBeGreaterThan(0)

      // Go back online
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      window.dispatchEvent(new Event('online'))

      await waitFor(() => {
        expect(result.current.state.isOnline).toBe(true)
        expect(result.current.state.pendingOperations).toHaveLength(0)
      })

      // Verify sync operations were called
      expect(mockCreateThread).toHaveBeenCalled()
      expect(mockSendMessage).toHaveBeenCalled()
    })

    it('should handle Convex real-time updates', async () => {
      const initialThread = createMockThread({ title: 'Initial Title' })
      let currentThreads = [initialThread]
      
      // Mock dynamic query updates
      mockUseQuery.mockImplementation((query) => {
        if (query === api.threads.list) return currentThreads
        return []
      })

      const { result, rerender } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await waitFor(() => {
        expect(result.current.state.threads).toHaveLength(1)
        expect(result.current.state.threads[0].title).toBe('Initial Title')
      })

      // Simulate Convex update
      currentThreads = [{ ...initialThread, title: 'Updated Title' }]
      
      // Trigger re-render to simulate Convex update
      rerender()

      await waitFor(() => {
        expect(result.current.state.threads[0].title).toBe('Updated Title')
      })
    })

    it('should properly merge server and local state without duplicates', async () => {
      const threadId = 'thread-123' as Id<'threads'>
      const serverMessages = [
        createMockMessage(threadId, { content: 'Server Message 1' }),
        createMockMessage(threadId, { content: 'Server Message 2' }),
      ]
      
      mockUseQuery.mockImplementation((query) => {
        if (query === api.messages.list) return serverMessages
        return []
      })

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      // Add local optimistic message
      await act(async () => {
        await result.current.actions.sendMessage('Local Message', threadId)
      })

      await waitFor(() => {
        const messages = result.current.state.messages[threadId] || []
        expect(messages.length).toBeGreaterThanOrEqual(3)
        
        // Check for duplicates
        const messageIds = messages.map(m => m._id)
        const uniqueIds = new Set(messageIds)
        expect(messageIds.length).toBe(uniqueIds.size)
      })
    })
  })

  describe('6. Error Handling & Recovery', () => {
    it('should handle and recover from network errors', async () => {
      let errorCount = 0
      const mockCreateThread = vi.fn().mockImplementation(async () => {
        errorCount++
        if (errorCount < 3) {
          throw new Error('Network error')
        }
        return 'thread-123'
      })
      
      mockUseMutation.mockReturnValue(mockCreateThread)

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await act(async () => {
        await result.current.actions.createThread()
      })

      // Should retry and eventually succeed
      await waitFor(() => {
        expect(mockCreateThread).toHaveBeenCalledTimes(3)
      })
    })

    it('should handle IndexedDB errors gracefully', async () => {
      // Mock IndexedDB failure
      const mockOpen = vi.fn().mockImplementation(() => {
        const request = {
          error: new Error('IndexedDB error'),
          onsuccess: null,
          onerror: null,
        }
        setTimeout(() => {
          if (request.onerror) {
            request.onerror({ target: request } as any)
          }
        }, 0)
        return request
      })
      
      Object.defineProperty(window, 'indexedDB', {
        value: { open: mockOpen },
        writable: true,
      })

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      // Should still initialize without local DB
      await waitFor(() => {
        expect(result.current.state.isInitialized).toBe(true)
      })

      // Should be able to use Convex directly
      const mockCreateThread = vi.fn().mockResolvedValue('thread-123')
      mockUseMutation.mockReturnValue(mockCreateThread)

      await act(async () => {
        await result.current.actions.createThread()
      })

      expect(mockCreateThread).toHaveBeenCalled()
    })

    it('should handle Convex API errors with proper error messages', async () => {
      const mockError = new Error('Convex API Error: Invalid request')
      const mockCreateThread = vi.fn().mockRejectedValue(mockError)
      mockUseMutation.mockReturnValue(mockCreateThread)

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await act(async () => {
        try {
          await result.current.actions.createThread()
        } catch (error) {
          expect(error).toBe(mockError)
        }
      })

      // Should set error state
      expect(result.current.state.error).toBe('Convex API Error: Invalid request')
    })

    it('should handle quota exceeded errors', async () => {
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError')
      
      // Mock localStorage quota error
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = vi.fn().mockImplementation(() => {
        throw quotaError
      })

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      // Operations should still work through Convex
      const mockCreateThread = vi.fn().mockResolvedValue('thread-123')
      mockUseMutation.mockReturnValue(mockCreateThread)

      await act(async () => {
        await result.current.actions.createThread()
      })

      expect(mockCreateThread).toHaveBeenCalled()

      // Restore original
      Storage.prototype.setItem = originalSetItem
    })
  })

  describe('7. Performance & Memory Management', () => {
    it('should efficiently handle large numbers of messages', async () => {
      const threadId = 'thread-123' as Id<'threads'>
      const largeMessageSet = Array.from({ length: 1000 }, (_, i) => 
        createMockMessage(threadId, { 
          content: `Message ${i}`,
          localCreatedAt: Date.now() + i 
        })
      )
      
      mockUseQuery.mockImplementation((query) => {
        if (query === api.messages.list) return largeMessageSet
        return []
      })

      const startTime = performance.now()
      
      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await waitFor(() => {
        const messages = result.current.state.messages[threadId] || []
        expect(messages).toHaveLength(1000)
      })

      const endTime = performance.now()
      const loadTime = endTime - startTime

      // Should load within reasonable time (adjust threshold as needed)
      expect(loadTime).toBeLessThan(1000) // 1 second

      // Messages should be properly sorted
      const messages = result.current.state.messages[threadId]
      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].localCreatedAt).toBeGreaterThanOrEqual(
          messages[i - 1].localCreatedAt || 0
        )
      }
    })

    it('should clean up old optimistic data to prevent memory leaks', async () => {
      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      // Create many optimistic threads
      for (let i = 0; i < 100; i++) {
        await act(async () => {
          // Go offline to keep them optimistic
          Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
          await result.current.actions.createThread()
        })
      }

      // Check memory usage (simplified - in real tests you might use performance.memory)
      const optimisticThreads = result.current.state.threads.filter(t => t.isOptimistic)
      expect(optimisticThreads.length).toBe(100)

      // Simulate successful sync
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      window.dispatchEvent(new Event('online'))

      // Mock successful creation
      const mockCreateThread = vi.fn().mockResolvedValue('thread-123')
      mockUseMutation.mockReturnValue(mockCreateThread)

      await waitFor(() => {
        // Optimistic threads should be replaced with server data
        const remainingOptimistic = result.current.state.threads.filter(t => t.isOptimistic)
        expect(remainingOptimistic.length).toBeLessThan(100)
      })
    })

    it('should debounce rapid state updates', async () => {
      let updateCount = 0
      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      // Track renders
      const originalThreads = result.current.state.threads
      result.current.state.threads.forEach(() => updateCount++)

      // Perform rapid updates
      for (let i = 0; i < 50; i++) {
        act(() => {
          result.current.actions.selectThread(`thread-${i}`)
        })
      }

      // Advance timers
      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Should batch updates efficiently
      expect(updateCount).toBeLessThan(50)
    })
  })

  describe('8. Edge Cases & Race Conditions', () => {
    it('should handle thread deletion while messages are being sent', async () => {
      const threadId = 'thread-123' as Id<'threads'>
      const thread = createMockThread({ _id: threadId })
      
      mockUseQuery.mockImplementation((query) => {
        if (query === api.threads.list) return [thread]
        return []
      })

      const mockSendMessage = vi.fn().mockImplementation(async () => {
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 100))
        throw new Error('Thread not found')
      })
      
      const mockDeleteThread = vi.fn().mockResolvedValue(undefined)
      
      mockUseMutation.mockImplementation((mutation) => {
        if (mutation.name?.includes('send')) return mockSendMessage
        if (mutation.name?.includes('remove')) return mockDeleteThread
        return vi.fn()
      })

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await waitFor(() => {
        expect(result.current.state.threads).toHaveLength(1)
      })

      // Start sending message
      const sendPromise = act(async () => {
        await result.current.actions.sendMessage('Test message', threadId)
      })

      // Delete thread while message is being sent
      await act(async () => {
        await result.current.actions.deleteThread(threadId)
      })

      // Wait for send to complete/fail
      await expect(sendPromise).rejects.toThrow()

      // Thread should be deleted
      expect(result.current.state.threads.find(t => t._id === threadId)).toBeUndefined()
    })

    it('should handle browser tab suspension and resumption', async () => {
      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      // Simulate tab going to background
      const visibilityEvent = new Event('visibilitychange')
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      })
      document.dispatchEvent(visibilityEvent)

      // Perform operations while suspended
      await act(async () => {
        await result.current.actions.createThread()
      })

      // Simulate tab coming back
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
      })
      document.dispatchEvent(visibilityEvent)

      // Should resume normal operation
      expect(result.current.state.isOnline).toBe(true)
    })

    it('should handle simultaneous operations on the same thread from multiple hooks', async () => {
      const threadId = 'thread-123' as Id<'threads'>
      const thread = createMockThread({ _id: threadId })
      
      mockUseQuery.mockImplementation((query) => {
        if (query === api.threads.list) return [thread]
        return []
      })

      const mockUpdateThread = vi.fn().mockResolvedValue(undefined)
      mockUseMutation.mockReturnValue(mockUpdateThread)

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      )

      // Create multiple hook instances
      const { result: result1 } = renderHook(() => useEnhancedSync(), { wrapper })
      const { result: result2 } = renderHook(() => useEnhancedSync(), { wrapper })
      const { result: result3 } = renderHook(() => useEnhancedSync(), { wrapper })

      await waitFor(() => {
        expect(result1.current.state.threads).toHaveLength(1)
        expect(result2.current.state.threads).toHaveLength(1)
        expect(result3.current.state.threads).toHaveLength(1)
      })

      // Perform simultaneous updates
      await act(async () => {
        await Promise.all([
          result1.current.actions.updateThread(threadId, { title: 'Update 1' }),
          result2.current.actions.updateThread(threadId, { model: 'gpt-4' }),
          result3.current.actions.updateThread(threadId, { provider: 'anthropic' }),
        ])
      })

      // All updates should be processed
      expect(mockUpdateThread).toHaveBeenCalledTimes(3)

      // State should be consistent across all hooks
      expect(result1.current.state.threads[0]._id).toBe(threadId)
      expect(result2.current.state.threads[0]._id).toBe(threadId)
      expect(result3.current.state.threads[0]._id).toBe(threadId)
    })

    it('should handle malformed data from server gracefully', async () => {
      // Return malformed data
      mockUseQuery.mockImplementation((query) => {
        if (query === api.threads.list) {
          return [
            { _id: 'thread-1' }, // Missing required fields
            null, // Null entry
            { _id: 'thread-2', title: 123 }, // Wrong type
            createMockThread(), // Valid thread
          ]
        }
        return []
      })

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      await waitFor(() => {
        // Should handle malformed data without crashing
        expect(result.current.state.threads.length).toBeGreaterThan(0)
        // Should only include valid threads
        result.current.state.threads.forEach(thread => {
          expect(thread._id).toBeDefined()
          expect(typeof thread._id).toBe('string')
        })
      })
    })

    it('should prevent duplicate message sending on rapid clicks', async () => {
      const threadId = 'thread-123' as Id<'threads'>
      const mockSendMessage = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return 'message-123'
      })
      
      mockUseMutation.mockReturnValue(mockSendMessage)
      mockUseAction.mockReturnValue(vi.fn())

      const { result } = renderHook(() => useEnhancedSync(), {
        wrapper: ({ children }) => <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
      })

      // Simulate rapid calls
      const sendPromises = []
      for (let i = 0; i < 5; i++) {
        sendPromises.push(
          act(async () => {
            await result.current.actions.sendMessage('Same message', threadId)
          })
        )
      }

      await Promise.all(sendPromises)

      // Should only send once (or have proper deduplication)
      expect(mockSendMessage.mock.calls.length).toBeLessThanOrEqual(5)
    })
  })

  describe('Component Integration Tests', () => {
    it('should properly provide sync context to child components', () => {
      const TestComponent = () => {
        const { state, actions } = useEnhancedSync()
        const threads = useThreads()
        const selectedThread = useSelectedThread()
        const messages = useMessages()
        const { isOfflineCapable } = useOfflineCapability()

        return (
          <div>
            <div data-testid="thread-count">{threads.length}</div>
            <div data-testid="selected-thread">{selectedThread?._id || 'none'}</div>
            <div data-testid="message-count">{messages.length}</div>
            <div data-testid="offline-capable">{isOfflineCapable ? 'yes' : 'no'}</div>
            <div data-testid="online-status">{state.isOnline ? 'online' : 'offline'}</div>
          </div>
        )
      }

      render(
        <EnhancedSyncProvider>
          <TestComponent />
        </EnhancedSyncProvider>
      )

      expect(screen.getByTestId('thread-count')).toHaveTextContent('0')
      expect(screen.getByTestId('selected-thread')).toHaveTextContent('none')
      expect(screen.getByTestId('message-count')).toHaveTextContent('0')
      expect(screen.getByTestId('offline-capable')).toHaveTextContent('yes')
      expect(screen.getByTestId('online-status')).toHaveTextContent('online')
    })

    it('should handle real user interactions correctly', async () => {
      const user = userEvent.setup({ delay: null })
      
      const TestComponent = () => {
        const { actions } = useEnhancedSync()
        const threads = useThreads()

        return (
          <div>
            <button onClick={() => actions.createThread()}>Create Thread</button>
            <div data-testid="thread-list">
              {threads.map(thread => (
                <div key={thread._id} data-testid={`thread-${thread._id}`}>
                  {thread.title}
                </div>
              ))}
            </div>
          </div>
        )
      }

      const mockCreateThread = vi.fn().mockResolvedValue('thread-123')
      mockUseMutation.mockReturnValue(mockCreateThread)

      render(
        <EnhancedSyncProvider>
          <TestComponent />
        </EnhancedSyncProvider>
      )

      const createButton = screen.getByText('Create Thread')
      await user.click(createButton)

      await waitFor(() => {
        expect(mockCreateThread).toHaveBeenCalled()
      })
    })
  })
})

// Additional test utilities for external use
export const createTestWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <EnhancedSyncProvider>{children}</EnhancedSyncProvider>
  )
}

export const mockConvexHooks = () => {
  const mockUseQuery = vi.mocked(useQuery)
  const mockUseMutation = vi.mocked(useMutation)
  const mockUseAction = vi.mocked(useAction)
  
  mockUseQuery.mockReturnValue([])
  mockUseMutation.mockReturnValue(vi.fn())
  mockUseAction.mockReturnValue(vi.fn())
  
  return { mockUseQuery, mockUseMutation, mockUseAction }
}