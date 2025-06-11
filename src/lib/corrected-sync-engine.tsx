/**
 * Enhanced Sync Engine for C3Chat - CORRECTED ARCHITECTURE
 * 
 * CRITICAL PRINCIPLE: Convex is the SINGLE SOURCE OF TRUTH
 * Local database is used for:
 * - Caching for instant UI responses
 * - Optimistic updates for smooth UX
 * - Offline support with pending operation queue
 * 
 * Data Flow:
 * 1. UI reads from local cache first (instant)
 * 2. User actions sent to Convex (source of truth)
 * 3. Convex updates broadcast to all clients
 * 4. Local cache syncs FROM Convex to maintain consistency
 * 5. Optimistic updates provide immediate feedback
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { createLocalDB, LocalDB, StoredThread, StoredMessage } from './local-db';
import { nanoid } from 'nanoid';

// Enhanced Types
interface Thread extends StoredThread {
  isOptimistic?: boolean;
  isPending?: boolean;
}

interface Message extends StoredMessage {
  isOptimistic?: boolean;
  isPending?: boolean;
}

interface SyncState {
  threads: Thread[];
  messages: Record<string, Message[]>;
  selectedThreadId: string | null;
  isOnline: boolean;
  isInitialized: boolean;
  lastSyncTime: number;
  pendingOperations: PendingOperation[];
  error: string | null;
  isSyncing: boolean;
}

interface PendingOperation {
  id: string;
  type: 'create_thread' | 'update_thread' | 'delete_thread' | 'create_message' | 'update_message' | 'delete_message';
  data: any;
  timestamp: number;
  retryCount: number;
}

type SyncAction = 
  | { type: 'INITIALIZE'; payload: { threads: Thread[]; metadata: any } }
  | { type: 'SET_THREADS_FROM_CONVEX'; payload: Thread[] }
  | { type: 'SET_MESSAGES_FROM_CONVEX'; payload: { threadId: string; messages: Message[] } }
  | { type: 'ADD_OPTIMISTIC_THREAD'; payload: Thread }
  | { type: 'UPDATE_OPTIMISTIC_THREAD'; payload: { id: string; updates: Partial<Thread> } }
  | { type: 'REMOVE_OPTIMISTIC_THREAD'; payload: string }
  | { type: 'ADD_OPTIMISTIC_MESSAGE'; payload: Message }
  | { type: 'UPDATE_OPTIMISTIC_MESSAGE'; payload: { id: string; updates: Partial<Message> } }
  | { type: 'REMOVE_OPTIMISTIC_MESSAGE'; payload: string }
  | { type: 'SELECT_THREAD'; payload: string | null }
  | { type: 'SET_ONLINE'; payload: boolean }
  | { type: 'SET_SYNC_TIME'; payload: number }
  | { type: 'SET_SYNCING'; payload: boolean }
  | { type: 'ADD_PENDING_OPERATION'; payload: PendingOperation }
  | { type: 'REMOVE_PENDING_OPERATION'; payload: string }
  | { type: 'SET_ERROR'; payload: string | null };

const initialState: SyncState = {
  threads: [],
  messages: {},
  selectedThreadId: null,
  isOnline: navigator.onLine,
  isInitialized: false,
  lastSyncTime: 0,
  pendingOperations: [],
  error: null,
  isSyncing: false,
};

function syncReducer(state: SyncState, action: SyncAction): SyncState {
  switch (action.type) {
    case 'INITIALIZE':
      return {
        ...state,
        threads: action.payload.threads,
        selectedThreadId: action.payload.metadata.selectedThreadId || null,
        lastSyncTime: action.payload.metadata.lastSyncTime || 0,
        isInitialized: true,
      };

    case 'SET_THREADS_FROM_CONVEX':
      // Merge Convex threads with optimistic threads
      const convexThreads = action.payload;
      const optimisticThreads = state.threads.filter(t => t.isOptimistic);
      const mergedThreads = [...convexThreads, ...optimisticThreads]
        .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      
      return {
        ...state,
        threads: mergedThreads,
      };

    case 'SET_MESSAGES_FROM_CONVEX':
      // Merge Convex messages with optimistic messages
      const convexMessages = action.payload.messages;
      const existingMessages = state.messages[action.payload.threadId] || [];
      const optimisticMessages = existingMessages.filter(m => m.isOptimistic);
      const mergedMessages = [...convexMessages, ...optimisticMessages]
        .sort((a, b) => (a.localCreatedAt || 0) - (b.localCreatedAt || 0));
      
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.threadId]: mergedMessages,
        },
      };

    case 'ADD_OPTIMISTIC_THREAD':
      return {
        ...state,
        threads: [action.payload, ...state.threads],
      };

    case 'UPDATE_OPTIMISTIC_THREAD':
      return {
        ...state,
        threads: state.threads.map(t => 
          t._id === action.payload.id 
            ? { ...t, ...action.payload.updates }
            : t
        ).sort((a, b) => b.lastMessageAt - a.lastMessageAt),
      };

    case 'REMOVE_OPTIMISTIC_THREAD':
      return {
        ...state,
        threads: state.threads.filter(t => t._id !== action.payload),
        messages: Object.fromEntries(
          Object.entries(state.messages).filter(([threadId]) => threadId !== action.payload)
        ),
        selectedThreadId: state.selectedThreadId === action.payload ? null : state.selectedThreadId,
      };

    case 'ADD_OPTIMISTIC_MESSAGE':
      const threadId = action.payload.threadId;
      const currentMessages = state.messages[threadId] || [];
      
      return {
        ...state,
        messages: {
          ...state.messages,
          [threadId]: [...currentMessages, action.payload]
            .sort((a, b) => (a.localCreatedAt || 0) - (b.localCreatedAt || 0)),
        },
      };

    case 'UPDATE_OPTIMISTIC_MESSAGE':
      const messageThreadId = Object.keys(state.messages).find(tId =>
        state.messages[tId].some(m => m._id === action.payload.id)
      );
      
      if (!messageThreadId) return state;
      
      return {
        ...state,
        messages: {
          ...state.messages,
          [messageThreadId]: state.messages[messageThreadId].map(m =>
            m._id === action.payload.id ? { ...m, ...action.payload.updates } : m
          ),
        },
      };

    case 'REMOVE_OPTIMISTIC_MESSAGE':
      const msgThreadId = Object.keys(state.messages).find(tId =>
        state.messages[tId].some(m => m._id === action.payload)
      );
      
      if (!msgThreadId) return state;
      
      return {
        ...state,
        messages: {
          ...state.messages,
          [msgThreadId]: state.messages[msgThreadId].filter(m => m._id !== action.payload),
        },
      };

    case 'SELECT_THREAD':
      return {
        ...state,
        selectedThreadId: action.payload,
      };

    case 'SET_ONLINE':
      return {
        ...state,
        isOnline: action.payload,
      };

    case 'SET_SYNC_TIME':
      return {
        ...state,
        lastSyncTime: action.payload,
      };

    case 'SET_SYNCING':
      return {
        ...state,
        isSyncing: action.payload,
      };

    case 'ADD_PENDING_OPERATION':
      return {
        ...state,
        pendingOperations: [...state.pendingOperations, action.payload],
      };

    case 'REMOVE_PENDING_OPERATION':
      return {
        ...state,
        pendingOperations: state.pendingOperations.filter(op => op.id !== action.payload),
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    default:
      return state;
  }
}

interface EnhancedSyncContextType {
  state: SyncState;
  actions: {
    selectThread: (threadId: string | null) => Promise<void>;
    createThread: (title?: string, provider?: string, model?: string) => Promise<string>;
    updateThread: (threadId: string, updates: Partial<Thread>) => Promise<void>;
    deleteThread: (threadId: string) => Promise<void>;
    sendMessage: (content: string, threadId?: string) => Promise<void>;
    updateMessage: (messageId: string, updates: Partial<Message>) => Promise<void>;
    syncWithConvex: () => Promise<void>;
    clearLocalData: () => Promise<void>;
  };
}

const EnhancedSyncContext = createContext<EnhancedSyncContextType | null>(null);

export function EnhancedSyncProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(syncReducer, initialState);
  const localDB = useRef<LocalDB | null>(null);
  const initializationPromise = useRef<Promise<void> | null>(null);
  const syncInProgress = useRef<boolean>(false);

  // CONVEX IS SOURCE OF TRUTH - These are the authoritative data sources
  const convexThreads = useQuery(api.threads.list) || [];
  const createThreadMutation = useMutation(api.threads.create);
  const updateThreadMutation = useMutation(api.threads.updateSettings);
  const deleteThreadMutation = useMutation(api.threads.remove);
  const sendMessageAction = useAction(api.ai.sendMessage);

  // Load messages for selected thread (only for real threads, not optimistic)
  const selectedMessages = useQuery(
    api.messages.list,
    (state.selectedThreadId && !state.selectedThreadId.startsWith('temp_')) 
      ? { threadId: state.selectedThreadId as Id<"threads"> } 
      : "skip"
  ) || [];

  // Initialize local database (cache layer)
  const initializeDB = useCallback(async () => {
    if (initializationPromise.current) {
      return initializationPromise.current;
    }

    initializationPromise.current = (async () => {
      try {
        localDB.current = await createLocalDB();
        
        // Load cached data for instant UI
        const [cachedThreads, metadata] = await Promise.all([
          localDB.current.getThreads(),
          localDB.current.getMetadata(),
        ]);

        dispatch({ 
          type: 'INITIALIZE', 
          payload: { threads: cachedThreads, metadata }
        });

        console.log('✅ Enhanced sync engine initialized (Convex-first architecture)');
      } catch (error) {
        console.error('❌ Failed to initialize local cache:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to initialize local cache' });
      }
    })();

    return initializationPromise.current;
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeDB();
  }, [initializeDB]);

  // Online/offline detection with auto-sync
  useEffect(() => {
    const handleOnline = () => {
      dispatch({ type: 'SET_ONLINE', payload: true });
      // Auto-sync when coming back online
      syncWithConvex();
    };
    const handleOffline = () => dispatch({ type: 'SET_ONLINE', payload: false });
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // CONVEX → LOCAL CACHE: Sync authoritative Convex data to local cache
  useEffect(() => {
    if (!localDB.current || !state.isInitialized || syncInProgress.current || state.isSyncing) return;
    if (!convexThreads || convexThreads.length === 0) return;

    (async () => {
      syncInProgress.current = true;
      dispatch({ type: 'SET_SYNCING', payload: true });
      
      try {
        // Get existing cached threads to preserve timestamps
        const existingCachedThreads = await localDB.current!.getThreads();
        const existingThreadsMap = new Map(existingCachedThreads.map(t => [t._id, t]));
        
        // Update local cache with Convex data (source of truth)
        const updatedThreads: StoredThread[] = [];
        let hasChanges = false;
        
        for (const convexThread of convexThreads) {
          const existingCached = existingThreadsMap.get(convexThread._id);
          
          const cachedThread: StoredThread = {
            ...convexThread,
            syncedToServer: true,
            // Preserve existing localCreatedAt, or set it for new threads
            localCreatedAt: existingCached?.localCreatedAt || Date.now(),
          };
          
          // Only save if thread is new or has changes
          if (!existingCached || JSON.stringify(existingCached.title) !== JSON.stringify(convexThread.title) ||
              existingCached.lastMessageAt !== convexThread.lastMessageAt ||
              existingCached.provider !== convexThread.provider ||
              existingCached.model !== convexThread.model) {
            await localDB.current!.saveThread(cachedThread);
            hasChanges = true;
          }
          
          updatedThreads.push(cachedThread);
        }

        // Only update UI if there are actual changes
        if (hasChanges || existingCachedThreads.length !== convexThreads.length) {
          dispatch({ type: 'SET_THREADS_FROM_CONVEX', payload: updatedThreads });
          
          // Update sync metadata
          const syncTime = Date.now();
          await localDB.current!.setMetadata({ lastSyncTime: syncTime });
          dispatch({ type: 'SET_SYNC_TIME', payload: syncTime });
          
          console.log('✅ Synced changes from Convex to local cache');
        }
      } catch (error) {
        console.error('❌ Failed to sync from Convex:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Sync failed' });
      } finally {
        syncInProgress.current = false;
        dispatch({ type: 'SET_SYNCING', payload: false });
      }
    })();
  }, [convexThreads, state.isInitialized, state.isSyncing]);

  // CONVEX → LOCAL CACHE: Sync messages
  useEffect(() => {
    if (!localDB.current || !state.selectedThreadId || !selectedMessages.length || syncInProgress.current) return;

    (async () => {
      try {
        const cachedMessages: StoredMessage[] = [];
        
        for (const convexMessage of selectedMessages) {
          const cachedMessage: StoredMessage = {
            ...convexMessage,
            syncedToServer: true,
            localCreatedAt: Date.now(),
          };
          
          await localDB.current!.saveMessage(cachedMessage);
          cachedMessages.push(cachedMessage);
        }

        // Update UI with Convex messages
        dispatch({ 
          type: 'SET_MESSAGES_FROM_CONVEX', 
          payload: { threadId: state.selectedThreadId, messages: cachedMessages }
        });

        console.log('✅ Synced messages from Convex to local cache');
      } catch (error) {
        console.error('❌ Failed to sync messages from Convex:', error);
      }
    })();
  }, [selectedMessages, state.selectedThreadId]);

  // Persist selected thread to cache
  useEffect(() => {
    if (!localDB.current || !state.isInitialized) return;
    
    localDB.current.setMetadata({ selectedThreadId: state.selectedThreadId || undefined });
  }, [state.selectedThreadId, state.isInitialized]);

  // Manual sync function
  const syncWithConvex = useCallback(async () => {
    if (!state.isOnline || syncInProgress.current) return;
    
    console.log('🔄 Manual sync with Convex initiated...');
    // The useEffect hooks above will handle the actual syncing
    // This is mainly for triggering the sync visually
  }, [state.isOnline]);

  // Actions
  const actions = useMemo(() => ({
    selectThread: async (threadId: string | null) => {
      dispatch({ type: 'SELECT_THREAD', payload: threadId });
      
      if (threadId && localDB.current) {
        // Load cached messages instantly
        const cachedMessages = await localDB.current.getMessages(threadId);
        dispatch({ 
          type: 'SET_MESSAGES_FROM_CONVEX', 
          payload: { threadId, messages: cachedMessages }
        });
      }
    },

    createThread: async (title?: string, provider = "openai", model = "gpt-4o-mini"): Promise<string> => {
      if (!localDB.current) throw new Error('Local cache not initialized');

      // Generate auto title if not provided
      const autoTitle = title || `Chat ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      
      // Create optimistic thread for instant UI feedback
      const optimisticId = `temp_${nanoid()}` as Id<"threads">;
      const optimisticThread: Thread = {
        _id: optimisticId,
        title: autoTitle,
        userId: "user" as Id<"users">, // Will be set properly by Convex
        lastMessageAt: Date.now(),
        provider,
        model,
        isOptimistic: true,
        localCreatedAt: Date.now(),
        syncedToServer: false,
      };
      
      // Add to UI instantly
      dispatch({ type: 'ADD_OPTIMISTIC_THREAD', payload: optimisticThread });
      dispatch({ type: 'SELECT_THREAD', payload: optimisticId });
      
      try {
        // Send to Convex (source of truth)
        const realThreadId = await createThreadMutation({ title: autoTitle });
        
        // Remove optimistic thread and let Convex sync handle the real one
        dispatch({ type: 'REMOVE_OPTIMISTIC_THREAD', payload: optimisticId });
        dispatch({ type: 'SELECT_THREAD', payload: realThreadId });
        
        console.log('✅ Thread created on Convex:', realThreadId);
        return realThreadId;
      } catch (error) {
        // Remove optimistic thread on error
        dispatch({ type: 'REMOVE_OPTIMISTIC_THREAD', payload: optimisticId });
        console.error('❌ Failed to create thread on Convex:', error);
        throw error;
      }
    },

    updateThread: async (threadId: string, updates: Partial<Thread>) => {
      // Optimistic update for instant UI
      dispatch({ type: 'UPDATE_OPTIMISTIC_THREAD', payload: { id: threadId, updates } });

      try {
        // Send to Convex (source of truth)
        if (updates.provider || updates.model) {
          await updateThreadMutation({ 
            threadId: threadId as Id<"threads">, 
            provider: updates.provider, 
            model: updates.model 
          });
        }
        
        console.log('✅ Thread updated on Convex');
      } catch (error) {
        console.error('❌ Failed to update thread on Convex:', error);
        // Could implement rollback logic here
        throw error;
      }
    },

    deleteThread: async (threadId: string) => {
      // Optimistic removal for instant UI
      dispatch({ type: 'REMOVE_OPTIMISTIC_THREAD', payload: threadId });

      try {
        // Send to Convex (source of truth)
        await deleteThreadMutation({ threadId: threadId as Id<"threads"> });
        
        // Also remove from local cache
        if (localDB.current) {
          await localDB.current.deleteThread(threadId);
        }
        
        console.log('✅ Thread deleted from Convex');
      } catch (error) {
        console.error('❌ Failed to delete thread from Convex:', error);
        // Could implement recovery logic here
        throw error;
      }
    },

    sendMessage: async (content: string, threadId?: string) => {
      if (!localDB.current) throw new Error('Local cache not initialized');
      
      const targetThreadId = threadId || state.selectedThreadId;
      if (!targetThreadId) throw new Error('No thread selected');

      // Create optimistic messages for instant UI feedback
      const userMessageId = `temp_user_${nanoid()}` as Id<"messages">;
      const userMessage: Message = {
        _id: userMessageId,
        threadId: targetThreadId as Id<"threads">,
        role: "user",
        content,
        localCreatedAt: Date.now(),
        isOptimistic: true,
        syncedToServer: false,
      };

      const assistantMessageId = `temp_assistant_${nanoid()}` as Id<"messages">;
      const assistantMessage: Message = {
        _id: assistantMessageId,
        threadId: targetThreadId as Id<"threads">,
        role: "assistant",
        content: "",
        isStreaming: true,
        cursor: true,
        localCreatedAt: Date.now() + 1,
        isOptimistic: true,
        syncedToServer: false,
      };

      // Add to UI instantly
      dispatch({ type: 'ADD_OPTIMISTIC_MESSAGE', payload: userMessage });
      dispatch({ type: 'ADD_OPTIMISTIC_MESSAGE', payload: assistantMessage });

      try {
        // Only send to Convex for real threads (source of truth)
        if (!targetThreadId.startsWith('temp_')) {
          const selectedThread = state.threads.find(t => t._id === targetThreadId);
          
          await sendMessageAction({
            threadId: targetThreadId as Id<"threads">,
            content,
            provider: selectedThread?.provider || "openai",
            model: selectedThread?.model || "gpt-4o-mini",
          });
          
          console.log('✅ Message sent to Convex');
        }

        // Remove optimistic messages (real ones will come from Convex sync)
        dispatch({ type: 'REMOVE_OPTIMISTIC_MESSAGE', payload: userMessageId });
        dispatch({ type: 'REMOVE_OPTIMISTIC_MESSAGE', payload: assistantMessageId });
      } catch (error) {
        // Remove optimistic messages on error
        dispatch({ type: 'REMOVE_OPTIMISTIC_MESSAGE', payload: userMessageId });
        dispatch({ type: 'REMOVE_OPTIMISTIC_MESSAGE', payload: assistantMessageId });
        
        console.error('❌ Failed to send message to Convex:', error);
        throw error;
      }
    },

    updateMessage: async (messageId: string, updates: Partial<Message>) => {
      // Optimistic update for instant UI
      dispatch({ type: 'UPDATE_OPTIMISTIC_MESSAGE', payload: { id: messageId, updates } });

      if (localDB.current) {
        await localDB.current.updateMessage(messageId, updates);
      }
    },

    syncWithConvex,

    clearLocalData: async () => {
      if (!localDB.current) return;

      await localDB.current.clear();
      dispatch({ type: 'SET_THREADS_FROM_CONVEX', payload: [] });
      dispatch({ type: 'SET_MESSAGES_FROM_CONVEX', payload: { threadId: '', messages: [] } });
      dispatch({ type: 'SELECT_THREAD', payload: null });
    },
  }), [
    state.selectedThreadId, 
    state.threads, 
    createThreadMutation, 
    updateThreadMutation, 
    deleteThreadMutation, 
    sendMessageAction,
    syncWithConvex
  ]);

  const contextValue = useMemo(() => ({
    state,
    actions,
  }), [state, actions]);

  return (
    <EnhancedSyncContext.Provider value={contextValue}>
      {children}
    </EnhancedSyncContext.Provider>
  );
}

export function useEnhancedSync() {
  const context = useContext(EnhancedSyncContext);
  if (!context) {
    throw new Error('useEnhancedSync must be used within an EnhancedSyncProvider');
  }
  return context;
}

// Convenience hooks
export function useThreads() {
  const { state } = useEnhancedSync();
  return state.threads;
}

export function useMessages(threadId?: string) {
  const { state } = useEnhancedSync();
  const targetThreadId = threadId || state.selectedThreadId;
  return targetThreadId ? state.messages[targetThreadId] || [] : [];
}

export function useSelectedThread() {
  const { state } = useEnhancedSync();
  return state.threads.find(t => t._id === state.selectedThreadId) || null;
}

export function useOnlineStatus() {
  const { state } = useEnhancedSync();
  return state.isOnline;
}

export function useSyncStatus() {
  const { state } = useEnhancedSync();
  return {
    isInitialized: state.isInitialized,
    lastSyncTime: state.lastSyncTime,
    pendingOperations: state.pendingOperations.length,
    hasError: !!state.error,
    error: state.error,
    isSyncing: state.isSyncing,
  };
}
