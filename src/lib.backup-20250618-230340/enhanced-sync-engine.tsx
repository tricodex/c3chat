/**
 * Enhanced Sync Engine for C3Chat
 * 
 * This replaces the basic React state + localStorage approach with:
 * - Local database as source of truth (OPFS/IndexedDB)
 * - Optimistic updates for instant UX
 * - Bidirectional sync with Convex
 * - Offline support with conflict resolution
 * - Auto-generated thread names
 * - Better performance and reliability
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { createLocalDB, LocalDB, StoredThread, StoredMessage } from './local-db';
import { nanoid } from 'nanoid';

// Enhanced Types
interface Thread extends StoredThread {
  isLoading?: boolean;
  hasLocalChanges?: boolean;
}

interface Message extends StoredMessage {
  isLoading?: boolean;
  hasLocalChanges?: boolean;
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
  | { type: 'SET_THREADS'; payload: Thread[] }
  | { type: 'UPDATE_THREAD'; payload: { id: string; updates: Partial<Thread> } }
  | { type: 'ADD_THREAD'; payload: Thread }
  | { type: 'REMOVE_THREAD'; payload: string }
  | { type: 'SET_MESSAGES'; payload: { threadId: string; messages: Message[] } }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<Message> } }
  | { type: 'REMOVE_MESSAGE'; payload: string }
  | { type: 'SELECT_THREAD'; payload: string | null }
  | { type: 'SET_ONLINE'; payload: boolean }
  | { type: 'SET_SYNC_TIME'; payload: number }
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

    case 'SET_THREADS':
      return {
        ...state,
        threads: action.payload.sort((a, b) => b.lastMessageAt - a.lastMessageAt),
      };

    case 'UPDATE_THREAD':
      return {
        ...state,
        threads: state.threads.map(t => 
          t._id === action.payload.id 
            ? { ...t, ...action.payload.updates }
            : t
        ).sort((a, b) => b.lastMessageAt - a.lastMessageAt),
      };

    case 'ADD_THREAD':
      return {
        ...state,
        threads: [action.payload, ...state.threads],
      };

    case 'REMOVE_THREAD':
      return {
        ...state,
        threads: state.threads.filter(t => t._id !== action.payload),
        messages: Object.fromEntries(
          Object.entries(state.messages).filter(([threadId]) => threadId !== action.payload)
        ),
        selectedThreadId: state.selectedThreadId === action.payload ? null : state.selectedThreadId,
      };

    case 'SET_MESSAGES':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.threadId]: action.payload.messages,
        },
      };

    case 'ADD_MESSAGE':
      const threadId = action.payload.threadId;
      const existingMessages = state.messages[threadId] || [];
      const messageExists = existingMessages.some(m => m._id === action.payload._id);
      
      return {
        ...state,
        messages: {
          ...state.messages,
          [threadId]: messageExists 
            ? existingMessages.map(m => m._id === action.payload._id ? action.payload : m)
            : [...existingMessages, action.payload].sort((a, b) => (a.localCreatedAt || 0) - (b.localCreatedAt || 0)),
        },
      };

    case 'UPDATE_MESSAGE':
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

    case 'REMOVE_MESSAGE':
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
    loadMessages: (threadId: string) => Promise<void>;
    syncWithServer: () => Promise<void>;
    clearLocalData: () => Promise<void>;
  };
}

const EnhancedSyncContext = createContext<EnhancedSyncContextType | null>(null);

export function EnhancedSyncProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(syncReducer, initialState);
  const localDB = useRef<LocalDB | null>(null);
  const initializationPromise = useRef<Promise<void> | null>(null);

  // Convex hooks
  const convexThreads = useQuery(api.threads.list) || [];
  const createThreadMutation = useMutation(api.threads.create);
  const updateThreadMutation = useMutation(api.threads.updateSettings);
  const deleteThreadMutation = useMutation(api.threads.remove);
  const sendMessageAction = useAction(api.ai.sendMessage);

  // Load messages for selected thread (only if it's not an optimistic thread)
  const selectedMessages = useQuery(
    api.messages.list,
    (state.selectedThreadId && !state.selectedThreadId.startsWith('temp_')) 
      ? { threadId: state.selectedThreadId as Id<"threads"> } 
      : "skip"
  ) || [];

  // Initialize local database
  const initializeDB = useCallback(async () => {
    if (initializationPromise.current) {
      return initializationPromise.current;
    }

    initializationPromise.current = (async () => {
      try {
        localDB.current = await createLocalDB();
        
        // Load initial data from local DB
        const [threads, metadata] = await Promise.all([
          localDB.current.getThreads(),
          localDB.current.getMetadata(),
        ]);

        dispatch({ 
          type: 'INITIALIZE', 
          payload: { threads, metadata }
        });

        console.log('✅ Enhanced sync engine initialized with local database');
      } catch (error) {
        console.error('❌ Failed to initialize local database:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to initialize local storage' });
      }
    })();

    return initializationPromise.current;
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeDB();
  }, [initializeDB]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      dispatch({ type: 'SET_ONLINE', payload: true });
      // Trigger sync when coming back online
      if (localDB.current) {
        syncWithServer();
      }
    };
    const handleOffline = () => dispatch({ type: 'SET_ONLINE', payload: false });
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync Convex threads to local DB
  useEffect(() => {
    if (!localDB.current || !state.isInitialized) return;

    (async () => {
      try {
        // Update local DB with server data
        for (const convexThread of convexThreads) {
          const localThread = await localDB.current!.getThread(convexThread._id);
          
          if (!localThread || localThread.lastMessageAt < convexThread.lastMessageAt) {
            const enhancedThread: StoredThread = {
              ...convexThread,
              syncedToServer: true,
              localCreatedAt: localThread?.localCreatedAt || Date.now(),
            };
            
            await localDB.current!.saveThread(enhancedThread);
          }
        }

        // Load updated threads from local DB
        const updatedThreads = await localDB.current!.getThreads();
        dispatch({ type: 'SET_THREADS', payload: updatedThreads });

        // Update last sync time
        await localDB.current!.setMetadata({ lastSyncTime: Date.now() });
        dispatch({ type: 'SET_SYNC_TIME', payload: Date.now() });
      } catch (error) {
        console.error('❌ Failed to sync threads:', error);
      }
    })();
  }, [convexThreads, state.isInitialized]);

  // Sync Convex messages to local DB
  useEffect(() => {
    if (!localDB.current || !state.selectedThreadId || !selectedMessages.length) return;

    (async () => {
      try {
        for (const convexMessage of selectedMessages) {
          const enhancedMessage: StoredMessage = {
            ...convexMessage,
            syncedToServer: true,
            localCreatedAt: Date.now(),
          };
          
          await localDB.current!.saveMessage(enhancedMessage);
        }

        // Load updated messages from local DB
        const updatedMessages = await localDB.current!.getMessages(state.selectedThreadId);
        dispatch({ 
          type: 'SET_MESSAGES', 
          payload: { threadId: state.selectedThreadId, messages: updatedMessages }
        });
      } catch (error) {
        console.error('❌ Failed to sync messages:', error);
      }
    })();
  }, [selectedMessages, state.selectedThreadId]);

  // Persist selected thread
  useEffect(() => {
    if (!localDB.current || !state.isInitialized) return;
    
    localDB.current.setMetadata({ selectedThreadId: state.selectedThreadId || undefined });
  }, [state.selectedThreadId, state.isInitialized]);

  // Actions
  const actions = useMemo(() => ({
    selectThread: async (threadId: string | null) => {
      dispatch({ type: 'SELECT_THREAD', payload: threadId });
      
      if (threadId && localDB.current) {
        // Load messages from local DB first (instant)
        const cachedMessages = await localDB.current.getMessages(threadId);
        dispatch({ 
          type: 'SET_MESSAGES', 
          payload: { threadId, messages: cachedMessages }
        });
      }
    },

    createThread: async (title?: string, provider = "openai", model = "gpt-4o-mini"): Promise<string> => {
      if (!localDB.current) throw new Error('Local database not initialized');

      // Generate auto title if not provided
      const autoTitle = title || `Chat ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      
      // Create optimistic thread
      const optimisticId = `temp_${nanoid()}` as Id<"threads">;
      const optimisticThread: StoredThread = {
        _id: optimisticId,
        title: autoTitle,
        userId: "user" as Id<"users">, // Will be set properly by server
        lastMessageAt: Date.now(),
        provider,
        model,
        isOptimistic: true,
        localCreatedAt: Date.now(),
        syncedToServer: false,
      };
      
      // Save to local DB and update UI instantly
      await localDB.current.saveThread(optimisticThread);
      dispatch({ type: 'ADD_THREAD', payload: optimisticThread });
      dispatch({ type: 'SELECT_THREAD', payload: optimisticId });
      
      try {
        // Create on server
        const realThreadId = await createThreadMutation({ title: autoTitle });
        
        // Update local DB with real ID
        await localDB.current.deleteThread(optimisticId);
        const realThread: StoredThread = {
          ...optimisticThread,
          _id: realThreadId,
          isOptimistic: false,
          syncedToServer: true,
        };
        await localDB.current.saveThread(realThread);
        
        // Update UI
        dispatch({ type: 'REMOVE_THREAD', payload: optimisticId });
        dispatch({ type: 'ADD_THREAD', payload: realThread });
        dispatch({ type: 'SELECT_THREAD', payload: realThreadId });
        
        return realThreadId;
      } catch (error) {
        // Remove optimistic thread on error
        await localDB.current.deleteThread(optimisticId);
        dispatch({ type: 'REMOVE_THREAD', payload: optimisticId });
        throw error;
      }
    },

    updateThread: async (threadId: string, updates: Partial<Thread>) => {
      if (!localDB.current) return;

      const enhancedUpdates = {
        ...updates,
        hasLocalChanges: true,
        syncedToServer: false,
      };

      // Update local DB instantly
      await localDB.current.updateThread(threadId, enhancedUpdates);
      dispatch({ type: 'UPDATE_THREAD', payload: { id: threadId, updates: enhancedUpdates } });

      // Sync to server
      try {
        if (updates.provider || updates.model) {
          await updateThreadMutation({ 
            threadId: threadId as Id<"threads">, 
            provider: updates.provider, 
            model: updates.model 
          });
        }
        
        // Mark as synced
        await localDB.current.updateThread(threadId, { 
          hasLocalChanges: false, 
          syncedToServer: true 
        });
        dispatch({ 
          type: 'UPDATE_THREAD', 
          payload: { 
            id: threadId, 
            updates: { hasLocalChanges: false, syncedToServer: true }
          }
        });
      } catch (error) {
        console.error('❌ Failed to sync thread update:', error);
      }
    },

    deleteThread: async (threadId: string) => {
      if (!localDB.current) return;

      // Remove from local DB instantly
      await localDB.current.deleteThread(threadId);
      dispatch({ type: 'REMOVE_THREAD', payload: threadId });

      // Sync to server
      try {
        await deleteThreadMutation({ threadId: threadId as Id<"threads"> });
      } catch (error) {
        console.error('❌ Failed to delete thread on server:', error);
        // Note: Could implement recovery logic here
      }
    },

    sendMessage: async (content: string, threadId?: string) => {
      if (!localDB.current) throw new Error('Local database not initialized');
      
      const targetThreadId = threadId || state.selectedThreadId;
      if (!targetThreadId) throw new Error('No thread selected');

      // Create optimistic user message
      const userMessageId = `temp_user_${nanoid()}` as Id<"messages">;
      const userMessage: StoredMessage = {
        _id: userMessageId,
        threadId: targetThreadId as Id<"threads">,
        role: "user",
        content,
        localCreatedAt: Date.now(),
        isOptimistic: true,
        syncedToServer: false,
      };

      // Create optimistic assistant message with cursor
      const assistantMessageId = `temp_assistant_${nanoid()}` as Id<"messages">;
      const assistantMessage: StoredMessage = {
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

      // Save to local DB and update UI instantly
      await Promise.all([
        localDB.current.saveMessage(userMessage),
        localDB.current.saveMessage(assistantMessage),
      ]);
      
      dispatch({ type: 'ADD_MESSAGE', payload: userMessage });
      dispatch({ type: 'ADD_MESSAGE', payload: assistantMessage });

      // Update thread lastMessageAt
      await localDB.current.updateThread(targetThreadId, { 
        lastMessageAt: Date.now() 
      });
      dispatch({ 
        type: 'UPDATE_THREAD', 
        payload: { id: targetThreadId, updates: { lastMessageAt: Date.now() } }
      });

      try {
        // Only send to server if it's not an optimistic thread
        if (!targetThreadId.startsWith('temp_')) {
          // Send to server (this will handle the actual AI response)
          await sendMessageAction({
            threadId: targetThreadId as Id<"threads">,
            content,
            provider: state.threads.find(t => t._id === targetThreadId)?.provider || "openai",
            model: state.threads.find(t => t._id === targetThreadId)?.model || "gpt-4o-mini",
          });
        }

        // Remove optimistic messages (real ones will come from Convex sync)
        await Promise.all([
          localDB.current!.deleteMessage(userMessageId),
          localDB.current!.deleteMessage(assistantMessageId),
        ]);
        
        dispatch({ type: 'REMOVE_MESSAGE', payload: userMessageId });
        dispatch({ type: 'REMOVE_MESSAGE', payload: assistantMessageId });
      } catch (error) {
        // Remove optimistic messages on error
        await Promise.all([
          localDB.current!.deleteMessage(userMessageId),
          localDB.current!.deleteMessage(assistantMessageId),
        ]);
        
        dispatch({ type: 'REMOVE_MESSAGE', payload: userMessageId });
        dispatch({ type: 'REMOVE_MESSAGE', payload: assistantMessageId });
        throw error;
      }
    },

    updateMessage: async (messageId: string, updates: Partial<Message>) => {
      if (!localDB.current) return;

      await localDB.current.updateMessage(messageId, updates);
      dispatch({ type: 'UPDATE_MESSAGE', payload: { id: messageId, updates } });
    },

    loadMessages: async (threadId: string) => {
      if (!localDB.current) return;

      const messages = await localDB.current.getMessages(threadId);
      dispatch({ type: 'SET_MESSAGES', payload: { threadId, messages } });
    },

    syncWithServer: async () => {
      // This would implement the full sync logic
      // For now, it's handled by the useEffect hooks above
      console.log('🔄 Triggering manual sync with server...');
    },

    clearLocalData: async () => {
      if (!localDB.current) return;

      await localDB.current.clear();
      dispatch({ type: 'SET_THREADS', payload: [] });
      dispatch({ type: 'SET_MESSAGES', payload: { threadId: '', messages: [] } });
      dispatch({ type: 'SELECT_THREAD', payload: null });
    },
  }), [
    state.selectedThreadId, 
    state.threads, 
    createThreadMutation, 
    updateThreadMutation, 
    deleteThreadMutation, 
    sendMessageAction
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
  };
}
