import '@testing-library/jest-dom'
import { beforeEach, vi } from 'vitest'

// Ensure DOM globals are available
if (typeof global.document === 'undefined') {
  Object.defineProperty(global, 'document', {
    value: {
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      head: { appendChild: vi.fn(), removeChild: vi.fn() },
      createElement: vi.fn(() => ({
        textContent: '',
        appendChild: vi.fn(),
      })),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      getElementById: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    writable: true,
  })
}

// Mock OPFS (Origin Private File System)
Object.defineProperty(navigator, 'storage', {
  value: {
    getDirectory: vi.fn().mockRejectedValue(new Error('OPFS not supported in test environment')),
  },
  writable: true,
})

// Mock IndexedDB for testing
const createMockRequest = (result: any = null, shouldError: boolean = false) => {
  const request = {
    result,
    error: shouldError ? new Error('Mock error') : null,
    onsuccess: null as ((event: any) => void) | null,
    onerror: null as ((event: any) => void) | null,
    onupgradeneeded: null as ((event: any) => void) | null,
  }
  
  // Use Promise.resolve().then() to ensure proper async behavior
  void Promise.resolve().then(() => {
    if (shouldError && request.onerror) {
      request.onerror({ target: request } as any)
    } else if (!shouldError && request.onsuccess) {
      request.onsuccess({ target: request } as any)
    }
  })
  
  return request
}

// Separate stores for different object stores
const mockStores = {
  threads: new Map<string, any>(),
  messages: new Map<string, any>(),
  metadata: new Map<string, any>(),
}

const createMockObjectStore = (storeName: keyof typeof mockStores) => ({
  get: vi.fn((key: string) => {
    const value = mockStores[storeName].get(key)
    if (storeName === 'metadata' && key === 'config' && value) {
      // Return the nested structure for metadata
      return createMockRequest(value)
    }
    return createMockRequest(value || null)
  }),
  put: vi.fn((value: any, key?: string) => {
    let id: string
    
    if (storeName === 'metadata') {
      // Handle metadata structure: { key: 'config', value: actualData }
      id = value.key || key || 'config'
      mockStores[storeName].set(id, value)
    } else {
      id = key || value._id || value.id
      if (id) {
        mockStores[storeName].set(id, value)
      }
    }
    return createMockRequest(id)
  }),
  delete: vi.fn((key: string) => {
    const existed = mockStores[storeName].has(key)
    mockStores[storeName].delete(key)
    return createMockRequest(existed ? undefined : null)
  }),
  getAll: vi.fn(() => createMockRequest(Array.from(mockStores[storeName].values()))),
  clear: vi.fn(() => {
    mockStores[storeName].clear()
    return createMockRequest(undefined)
  }),
  createIndex: vi.fn(),
  index: vi.fn((indexName: string) => ({
    getAll: vi.fn(() => createMockRequest(Array.from(mockStores[storeName].values()))),
    openCursor: vi.fn(() => createMockRequest(null)),
  })),
})

const mockTransaction = {
  objectStore: vi.fn((storeName: string) => {
    return createMockObjectStore(storeName as keyof typeof mockStores)
  }),
  oncomplete: null,
  onerror: null,
  onabort: null,
}

const mockIDBDatabase = {
  version: 1,
  name: 'c3chat',
  objectStoreNames: {
    contains: vi.fn().mockReturnValue(true),
  },
  createObjectStore: vi.fn().mockReturnValue(createMockObjectStore('threads')),
  transaction: vi.fn().mockReturnValue(mockTransaction),
  close: vi.fn(),
  onerror: null,
  onabort: null,
  onversionchange: null,
}

const mockIDBFactory = {
  open: vi.fn((name: string, version?: number) => {
    const request = createMockRequest(mockIDBDatabase)
    // Simulate the full IndexedDB open flow
    void Promise.resolve().then(() => {
      // First trigger upgrade needed
      if (request.onupgradeneeded) {
        request.onupgradeneeded({ 
          target: request, 
          oldVersion: 0, 
          newVersion: version || 1 
        } as any)
      }
      // Then trigger success
      if (request.onsuccess) {
        request.onsuccess({ target: request } as any)
      }
    })
    return request
  }),
  deleteDatabase: vi.fn(() => createMockRequest(undefined)),
  databases: vi.fn().mockResolvedValue([]),
  cmp: vi.fn(),
}

Object.defineProperty(window, 'indexedDB', {
  value: mockIDBFactory,
  writable: true,
})

// Mock IDBKeyRange
Object.defineProperty(window, 'IDBKeyRange', {
  value: {
    only: vi.fn((value) => ({ only: value })),
    lowerBound: vi.fn((value, open = false) => ({ lowerBound: value, open })),
    upperBound: vi.fn((value, open = false) => ({ upperBound: value, open })),
    bound: vi.fn((lower, upper, lowerOpen = false, upperOpen = false) => ({ 
      lower, upper, lowerOpen, upperOpen 
    })),
  },
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
  // Clear mock IndexedDB store
  mockStores.threads.clear()
  mockStores.messages.clear()
  mockStores.metadata.clear()
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
