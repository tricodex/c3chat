import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThreadList } from '../ThreadList'
import React from 'react'

// Mock the enhanced sync engine (the one currently used by ThreadList)
const mockActions = {
  createThread: vi.fn(),
  selectThread: vi.fn(),
  deleteThread: vi.fn(),
  updateThread: vi.fn(),
  sendMessage: vi.fn(),
  updateMessage: vi.fn(),
  syncWithServer: vi.fn(),
  clearLocalData: vi.fn(),
}

const mockState = {
  threads: [],
  messages: {},
  selectedThreadId: null,
  isOnline: true,
  isInitialized: true,
  lastSyncTime: Date.now(),
  pendingOperations: [],
  error: null,
  isSyncing: false,
}

vi.mock('../../lib/enhanced-sync-engine', () => ({
  EnhancedSyncProvider: ({ children }: { children: React.ReactNode }) => children,
  useEnhancedSync: () => ({ state: mockState, actions: mockActions }),
  useThreads: () => mockState.threads,
  useOnlineStatus: () => mockState.isOnline,
  useSyncStatus: () => ({
    isInitialized: mockState.isInitialized,
    lastSyncTime: mockState.lastSyncTime,
    pendingOperations: mockState.pendingOperations.length,
    hasError: !!mockState.error,
    error: mockState.error,
    isSyncing: mockState.isSyncing,
  }),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe('ThreadList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock state
    mockState.threads = []
    mockState.selectedThreadId = null
    mockState.error = null
    mockState.isOnline = true
    mockState.isInitialized = true
  })

  const renderThreadList = () => {
    return render(<ThreadList />)
  }

  describe('Empty State', () => {
    it('should show empty state when no threads exist', () => {
      renderThreadList()
      
      expect(screen.getByText('No conversations yet')).toBeInTheDocument()
      expect(screen.getByText('Start your first chat to begin!')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument()
    })

    it('should show helpful suggestions in empty state', () => {
      renderThreadList()
      
      expect(screen.getByText('💡 Try asking about:')).toBeInTheDocument()
      expect(screen.getByText('• "Explain quantum computing"')).toBeInTheDocument()
      expect(screen.getByText('• "Write a Python function"')).toBeInTheDocument()
      expect(screen.getByText('• "/image a sunset over mountains"')).toBeInTheDocument()
    })
  })

  describe('Thread Display', () => {
    beforeEach(() => {
      mockState.threads = [
        {
          _id: 'thread-1',
          title: 'Test Thread 1',
          userId: 'user1',
          lastMessageAt: Date.now() - 1000,
          provider: 'openai',
          model: 'gpt-4o-mini',
          localCreatedAt: Date.now() - 1000,
          syncedToServer: true,
        },
        {
          _id: 'thread-2',
          title: 'Test Thread 2',
          userId: 'user1',
          lastMessageAt: Date.now() - 2000,
          provider: 'anthropic',
          model: 'claude-3-haiku',
          localCreatedAt: Date.now() - 2000,
          syncedToServer: true,
        },
      ]
    })

    it('should display threads when they exist', () => {
      renderThreadList()
      
      expect(screen.getByText('Test Thread 1')).toBeInTheDocument()
      expect(screen.getByText('Test Thread 2')).toBeInTheDocument()
      expect(screen.getByText('openai')).toBeInTheDocument()
      expect(screen.getByText('anthropic')).toBeInTheDocument()
    })

    it('should show thread count in footer', () => {
      renderThreadList()
      
      expect(screen.getByText('2 conversations')).toBeInTheDocument()
    })

    it('should handle singular thread count', () => {
      mockState.threads = [mockState.threads[0]]
      renderThreadList()
      
      expect(screen.getByText('1 conversation')).toBeInTheDocument()
    })
  })

  describe('Thread Interactions', () => {
    beforeEach(() => {
      mockState.threads = [
        {
          _id: 'thread-1',
          title: 'Test Thread',
          userId: 'user1',
          lastMessageAt: Date.now(),
          provider: 'openai',
          model: 'gpt-4o-mini',
          localCreatedAt: Date.now(),
          syncedToServer: true,
        },
      ]
    })

    it('should create new thread when button is clicked', async () => {
      mockActions.createThread.mockResolvedValue('new-thread-id')
      
      renderThreadList()
      
      const createButton = screen.getByRole('button', { name: /new chat/i })
      fireEvent.click(createButton)
      
      await waitFor(() => {
        expect(mockActions.createThread).toHaveBeenCalled()
      })
    })

    it('should select thread when clicked', async () => {
      renderThreadList()
      
      const threadElement = screen.getByText('Test Thread')
      fireEvent.click(threadElement)
      
      await waitFor(() => {
        expect(mockActions.selectThread).toHaveBeenCalledWith('thread-1')
      })
    })

    it('should show delete button on hover and handle deletion', async () => {
      // Mock window.confirm
      Object.defineProperty(window, 'confirm', {
        writable: true,
        value: vi.fn(() => true),
      })
      
      renderThreadList()
      
      // Find and click the delete button (it should be in the DOM even if initially hidden)
      const deleteButtons = screen.getAllByTitle('Delete chat')
      expect(deleteButtons.length).toBeGreaterThan(0)
      
      fireEvent.click(deleteButtons[0])
      
      expect(window.confirm).toHaveBeenCalledWith('Delete "Test Thread"? This cannot be undone.')
      
      await waitFor(() => {
        expect(mockActions.deleteThread).toHaveBeenCalledWith('thread-1')
      })
    })

    it('should not delete thread if user cancels confirmation', async () => {
      // Mock window.confirm to return false
      Object.defineProperty(window, 'confirm', {
        writable: true,
        value: vi.fn(() => false),
      })
      
      renderThreadList()
      
      const deleteButtons = screen.getAllByTitle('Delete chat')
      fireEvent.click(deleteButtons[0])
      
      expect(window.confirm).toHaveBeenCalled()
      expect(mockActions.deleteThread).not.toHaveBeenCalled()
    })
  })

  describe('Optimistic States', () => {
    it('should show loading state for optimistic threads', () => {
      mockState.threads = [
        {
          _id: 'temp_thread-1',
          title: 'Creating Thread...',
          userId: 'user1',
          lastMessageAt: Date.now(),
          isOptimistic: true,
          localCreatedAt: Date.now(),
          syncedToServer: false,
        },
      ]
      
      renderThreadList()
      
      expect(screen.getByText('Starting new conversation...')).toBeInTheDocument()
      // Should show loading spinner
      const loadingElement = document.querySelector('.animate-spin')
      expect(loadingElement).toBeInTheDocument()
    })

    it('should show sync indicator for threads with local changes', () => {
      mockState.threads = [
        {
          _id: 'thread-1',
          title: 'Test Thread',
          userId: 'user1',
          lastMessageAt: Date.now(),
          hasLocalChanges: true,
          localCreatedAt: Date.now(),
          syncedToServer: false,
        },
      ]
      
      renderThreadList()
      
      expect(screen.getByText('💾 Syncing changes...')).toBeInTheDocument()
    })
  })

  describe('Status Indicators', () => {
    it('should show online status', () => {
      mockState.isOnline = true
      renderThreadList()
      
      const onlineIndicator = document.querySelector('.bg-green-400')
      expect(onlineIndicator).toBeInTheDocument()
    })

    it('should show offline status and warning', () => {
      mockState.isOnline = false
      renderThreadList()
      
      const offlineIndicator = document.querySelector('.bg-red-400')
      expect(offlineIndicator).toBeInTheDocument()
      
      expect(screen.getByText('⚠️ Offline - changes will sync when connected')).toBeInTheDocument()
    })

    it('should show pending operations count', () => {
      mockState.pendingOperations = [
        { id: '1', type: 'create_thread', data: {}, timestamp: Date.now(), retryCount: 0 },
        { id: '2', type: 'create_message', data: {}, timestamp: Date.now(), retryCount: 0 },
      ]
      
      renderThreadList()
      
      expect(screen.getByText('2 pending')).toBeInTheDocument()
    })

    it('should show error state', () => {
      mockState.error = 'Something went wrong'
      renderThreadList()
      
      expect(screen.getByText('❌ Something went wrong')).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('should disable create button when creating', async () => {
      mockActions.createThread.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve('new-id'), 100)
      }))
      
      renderThreadList()
      
      const createButton = screen.getByRole('button', { name: /new chat/i })
      fireEvent.click(createButton)
      
      // Button should be disabled and show loading text
      await waitFor(() => {
        expect(createButton).toBeDisabled()
        expect(screen.getByText('Creating...')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      mockState.threads = [
        {
          _id: 'thread-1',
          title: 'Test Thread',
          userId: 'user1',
          lastMessageAt: Date.now(),
          localCreatedAt: Date.now(),
          syncedToServer: true,
        },
      ]
      
      renderThreadList()
      
      expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument()
      expect(screen.getByTitle('Delete chat')).toBeInTheDocument()
      expect(screen.getByTitle('Online')).toBeInTheDocument()
    })
  })
})
