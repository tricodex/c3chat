import '@testing-library/jest-dom'
import { beforeEach, vi } from 'vitest'

// Mock OPFS (Origin Private File System)
Object.defineProperty(navigator, 'storage', {
  value: {
    getDirectory: vi.fn().mockRejectedValue(new Error('OPFS not supported in test environment')),
  },
  writable: true,
})

// Mock IndexedDB for testing
const mockIDBRequest = {
  result: null,
  error: null,
  onsuccess: null,
  onerror: null,
  onupgradeneeded: null,
}

const mockIDBDatabase = {
  objectStoreNames: {
    contains: vi.fn().mockReturnValue(false),
  },
  createObjectStore: vi.fn().mockReturnValue({
    createIndex: vi.fn(),
  }),
  transaction: vi.fn().mockReturnValue({
    objectStore: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(mockIDBRequest),
      put: vi.fn().mockReturnValue(mockIDBRequest),
      delete: vi.fn().mockReturnValue(mockIDBRequest),
      getAll: vi.fn().mockReturnValue(mockIDBRequest),
      clear: vi.fn().mockReturnValue(mockIDBRequest),
      index: vi.fn().mockReturnValue({
        getAll: vi.fn().mockReturnValue(mockIDBRequest),
        openCursor: vi.fn().mockReturnValue(mockIDBRequest),
      }),
    }),
  }),
}

const mockIDBFactory = {
  open: vi.fn().mockReturnValue({
    ...mockIDBRequest,
    result: mockIDBDatabase,
  }),
}

Object.defineProperty(window, 'indexedDB', {
  value: mockIDBFactory,
  writable: true,
})

// Mock online/offline status
Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true,
})

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-id-' + Math.random().toString(36).substr(2, 9)),
}))

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})

// Mock Convex hooks for testing
vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
}))

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}
