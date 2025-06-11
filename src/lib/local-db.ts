/**
 * Modern Local Database for C3Chat
 * 
 * This implements a high-performance local database using:
 * - Primary: OPFS (Origin Private File System) - 3-4x faster than IndexedDB
 * - Fallback: IndexedDB for older browser compatibility
 * 
 * Key advantages:
 * - Much faster than localStorage
 * - Better persistence than IndexedDB
 * - Supports larger datasets
 * - Works offline
 * - Proper transaction support
 */

import { Id } from '../../convex/_generated/dataModel';

// Types
export interface StoredThread {
  _id: Id<"threads">;
  title: string;
  userId: Id<"users">;
  lastMessageAt: number;
  provider?: string;
  model?: string;
  isOptimistic?: boolean;
  localCreatedAt?: number;
  syncedToServer?: boolean;
}

export interface StoredMessage {
  _id: Id<"messages">;
  threadId: Id<"threads">;
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
  cursor?: boolean;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  generatedImageUrl?: string;
  isOptimistic?: boolean;
  localCreatedAt?: number;
  syncedToServer?: boolean;
}

export interface DatabaseMetadata {
  version: number;
  lastSyncTime: number;
  selectedThreadId?: string;
  storageType: 'opfs' | 'indexeddb';
}

// Local Database Interface
export interface LocalDB {
  // Thread operations
  getThreads(): Promise<StoredThread[]>;
  getThread(id: string): Promise<StoredThread | null>;
  saveThread(thread: StoredThread): Promise<void>;
  updateThread(id: string, updates: Partial<StoredThread>): Promise<void>;
  deleteThread(id: string): Promise<void>;
  
  // Message operations  
  getMessages(threadId: string): Promise<StoredMessage[]>;
  saveMessage(message: StoredMessage): Promise<void>;
  updateMessage(id: string, updates: Partial<StoredMessage>): Promise<void>;
  deleteMessage(id: string): Promise<void>;
  
  // Metadata
  getMetadata(): Promise<DatabaseMetadata>;
  setMetadata(metadata: Partial<DatabaseMetadata>): Promise<void>;
  
  // Cleanup and utilities
  clear(): Promise<void>;
  getSize(): Promise<number>;
  isAvailable(): Promise<boolean>;
}

// OPFS Implementation
class OPFSDatabase implements LocalDB {
  private opfsRoot: FileSystemDirectoryHandle | null = null;
  
  async initialize(): Promise<void> {
    try {
      this.opfsRoot = await navigator.storage.getDirectory();
    } catch (error) {
      throw new Error('OPFS not supported');
    }
  }

  private async ensureFile(filename: string): Promise<FileSystemFileHandle> {
    if (!this.opfsRoot) throw new Error('OPFS not initialized');
    return await this.opfsRoot.getFileHandle(filename, { create: true });
  }

  private async readJsonFile<T>(filename: string, defaultValue: T): Promise<T> {
    try {
      const fileHandle = await this.ensureFile(filename);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return text ? JSON.parse(text) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private async writeJsonFile(filename: string, data: any): Promise<void> {
    const fileHandle = await this.ensureFile(filename);
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  }

  async getThreads(): Promise<StoredThread[]> {
    return await this.readJsonFile('threads.json', []);
  }

  async getThread(id: string): Promise<StoredThread | null> {
    const threads = await this.getThreads();
    return threads.find(t => t._id === id) || null;
  }

  async saveThread(thread: StoredThread): Promise<void> {
    const threads = await this.getThreads();
    const existingIndex = threads.findIndex(t => t._id === thread._id);
    
    if (existingIndex >= 0) {
      threads[existingIndex] = thread;
    } else {
      threads.push(thread);
    }
    
    // Sort by lastMessageAt descending
    threads.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    
    await this.writeJsonFile('threads.json', threads);
  }

  async updateThread(id: string, updates: Partial<StoredThread>): Promise<void> {
    const threads = await this.getThreads();
    const threadIndex = threads.findIndex(t => t._id === id);
    
    if (threadIndex >= 0) {
      threads[threadIndex] = { ...threads[threadIndex], ...updates };
      threads.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      await this.writeJsonFile('threads.json', threads);
    }
  }

  async deleteThread(id: string): Promise<void> {
    const threads = await this.getThreads();
    const filteredThreads = threads.filter(t => t._id !== id);
    await this.writeJsonFile('threads.json', filteredThreads);
    
    // Also delete messages for this thread
    try {
      if (this.opfsRoot) {
        await this.opfsRoot.removeEntry(`messages-${id}.json`);
      }
    } catch {
      // File might not exist, ignore
    }
  }

  async getMessages(threadId: string): Promise<StoredMessage[]> {
    return await this.readJsonFile(`messages-${threadId}.json`, []);
  }

  async saveMessage(message: StoredMessage): Promise<void> {
    const messages = await this.getMessages(message.threadId);
    const existingIndex = messages.findIndex(m => m._id === message._id);
    
    if (existingIndex >= 0) {
      messages[existingIndex] = message;
    } else {
      messages.push(message);
    }
    
    // Sort by creation time
    messages.sort((a, b) => (a.localCreatedAt || 0) - (b.localCreatedAt || 0));
    
    await this.writeJsonFile(`messages-${message.threadId}.json`, messages);
  }

  async updateMessage(id: string, updates: Partial<StoredMessage>): Promise<void> {
    // Find which thread this message belongs to
    const threads = await this.getThreads();
    
    for (const thread of threads) {
      const messages = await this.getMessages(thread._id);
      const messageIndex = messages.findIndex(m => m._id === id);
      
      if (messageIndex >= 0) {
        messages[messageIndex] = { ...messages[messageIndex], ...updates };
        await this.writeJsonFile(`messages-${thread._id}.json`, messages);
        return;
      }
    }
  }

  async deleteMessage(id: string): Promise<void> {
    const threads = await this.getThreads();
    
    for (const thread of threads) {
      const messages = await this.getMessages(thread._id);
      const filteredMessages = messages.filter(m => m._id !== id);
      
      if (filteredMessages.length !== messages.length) {
        await this.writeJsonFile(`messages-${thread._id}.json`, filteredMessages);
        return;
      }
    }
  }

  async getMetadata(): Promise<DatabaseMetadata> {
    return await this.readJsonFile('metadata.json', {
      version: 1,
      lastSyncTime: 0,
      storageType: 'opfs' as const,
    });
  }

  async setMetadata(metadata: Partial<DatabaseMetadata>): Promise<void> {
    const current = await this.getMetadata();
    const updated = { ...current, ...metadata };
    await this.writeJsonFile('metadata.json', updated);
  }

  async clear(): Promise<void> {
    if (!this.opfsRoot) return;
    
    try {
      for await (const [name] of this.opfsRoot.entries()) {
        await this.opfsRoot.removeEntry(name);
      }
    } catch (error) {
      console.error('Failed to clear OPFS:', error);
    }
  }

  async getSize(): Promise<number> {
    if (!this.opfsRoot) return 0;
    
    let totalSize = 0;
    try {
      for await (const [name] of this.opfsRoot.entries()) {
        const fileHandle = await this.opfsRoot.getFileHandle(name);
        const file = await fileHandle.getFile();
        totalSize += file.size;
      }
    } catch (error) {
      console.error('Failed to calculate OPFS size:', error);
    }
    
    return totalSize;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.initialize();
      return true;
    } catch {
      return false;
    }
  }
}

// IndexedDB Implementation (Fallback)
class IndexedDBDatabase implements LocalDB {
  private dbName = 'c3chat';
  private version = 1;
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('threads')) {
          db.createObjectStore('threads', { keyPath: '_id' });
        }
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: '_id' });
          messageStore.createIndex('threadId', 'threadId', { unique: false });
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  private async withTransaction<T>(
    storeNames: string | string[],
    mode: IDBTransactionMode,
    operation: (transaction: IDBTransaction) => Promise<T>
  ): Promise<T> {
    if (!this.db) throw new Error('IndexedDB not initialized');
    
    const transaction = this.db.transaction(storeNames, mode);
    return operation(transaction);
  }

  async getThreads(): Promise<StoredThread[]> {
    return this.withTransaction('threads', 'readonly', async (tx) => {
      const store = tx.objectStore('threads');
      const request = store.getAll();
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const threads = request.result || [];
          threads.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
          resolve(threads);
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async getThread(id: string): Promise<StoredThread | null> {
    return this.withTransaction('threads', 'readonly', async (tx) => {
      const store = tx.objectStore('threads');
      const request = store.get(id);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async saveThread(thread: StoredThread): Promise<void> {
    await this.withTransaction('threads', 'readwrite', async (tx) => {
      const store = tx.objectStore('threads');
      const request = store.put(thread);
      
      return new Promise<void>((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  async updateThread(id: string, updates: Partial<StoredThread>): Promise<void> {
    const thread = await this.getThread(id);
    if (thread) {
      await this.saveThread({ ...thread, ...updates });
    }
  }

  async deleteThread(id: string): Promise<void> {
    await this.withTransaction(['threads', 'messages'], 'readwrite', async (tx) => {
      // Delete thread
      const threadStore = tx.objectStore('threads');
      threadStore.delete(id);
      
      // Delete all messages for this thread
      const messageStore = tx.objectStore('messages');
      const index = messageStore.index('threadId');
      const request = index.openCursor(IDBKeyRange.only(id));
      
      return new Promise<void>((resolve, reject) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async getMessages(threadId: string): Promise<StoredMessage[]> {
    return this.withTransaction('messages', 'readonly', async (tx) => {
      const store = tx.objectStore('messages');
      const index = store.index('threadId');
      const request = index.getAll(threadId);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const messages = request.result || [];
          messages.sort((a, b) => (a.localCreatedAt || 0) - (b.localCreatedAt || 0));
          resolve(messages);
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async saveMessage(message: StoredMessage): Promise<void> {
    await this.withTransaction('messages', 'readwrite', async (tx) => {
      const store = tx.objectStore('messages');
      const request = store.put(message);
      
      return new Promise<void>((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  async updateMessage(id: string, updates: Partial<StoredMessage>): Promise<void> {
    await this.withTransaction('messages', 'readwrite', async (tx) => {
      const store = tx.objectStore('messages');
      const getRequest = store.get(id);
      
      return new Promise<void>((resolve, reject) => {
        getRequest.onsuccess = () => {
          const message = getRequest.result;
          if (message) {
            const updated = { ...message, ...updates };
            const putRequest = store.put(updated);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          } else {
            resolve();
          }
        };
        getRequest.onerror = () => reject(getRequest.error);
      });
    });
  }

  async deleteMessage(id: string): Promise<void> {
    await this.withTransaction('messages', 'readwrite', async (tx) => {
      const store = tx.objectStore('messages');
      const request = store.delete(id);
      
      return new Promise<void>((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  async getMetadata(): Promise<DatabaseMetadata> {
    return this.withTransaction('metadata', 'readonly', async (tx) => {
      const store = tx.objectStore('metadata');
      const request = store.get('config');
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const result = request.result;
          resolve(result?.value || {
            version: 1,
            lastSyncTime: 0,
            storageType: 'indexeddb' as const,
          });
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async setMetadata(metadata: Partial<DatabaseMetadata>): Promise<void> {
    const current = await this.getMetadata();
    const updated = { ...current, ...metadata };
    
    await this.withTransaction('metadata', 'readwrite', async (tx) => {
      const store = tx.objectStore('metadata');
      const request = store.put({ key: 'config', value: updated });
      
      return new Promise<void>((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  async clear(): Promise<void> {
    await this.withTransaction(['threads', 'messages', 'metadata'], 'readwrite', async (tx) => {
      const threadStore = tx.objectStore('threads');
      const messageStore = tx.objectStore('messages');
      const metadataStore = tx.objectStore('metadata');
      
      threadStore.clear();
      messageStore.clear();
      metadataStore.clear();
      
      return Promise.resolve();
    });
  }

  async getSize(): Promise<number> {
    // IndexedDB doesn't provide direct size calculation
    // We'll estimate based on record counts
    const threads = await this.getThreads();
    const threadCount = threads.length;
    
    let messageCount = 0;
    for (const thread of threads) {
      const messages = await this.getMessages(thread._id);
      messageCount += messages.length;
    }
    
    // Rough estimate: 1KB per thread, 0.5KB per message
    return (threadCount * 1024) + (messageCount * 512);
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.initialize();
      return true;
    } catch {
      return false;
    }
  }
}

// Database Factory
export async function createLocalDB(): Promise<LocalDB> {
  // Try OPFS first (best performance)
  const opfsDB = new OPFSDatabase();
  if (await opfsDB.isAvailable()) {
    await opfsDB.initialize();
    console.log('✅ Using OPFS for local database (high performance)');
    return opfsDB;
  }
  
  // Fallback to IndexedDB
  const indexedDB = new IndexedDBDatabase();
  if (await indexedDB.isAvailable()) {
    await indexedDB.initialize();
    console.log('✅ Using IndexedDB for local database (compatibility mode)');
    return indexedDB;
  }
  
  throw new Error('No supported local database available');
}

// Storage capability detection
export function detectStorageCapabilities() {
  const capabilities = {
    opfs: 'getDirectory' in navigator.storage,
    indexedDB: 'indexedDB' in window,
    localStorage: 'localStorage' in window,
  };
  
  console.log('🔍 Storage capabilities:', capabilities);
  return capabilities;
}
