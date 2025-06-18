import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

// Types for our sync engine
interface Thread {
  _id: Id<"threads">;
  title: string;
  userId: Id<"users">;
  lastMessageAt: number;
  provider?: string;
  model?: string;
  isOptimistic?: boolean;
  isLoading?: boolean;
}

interface Message {
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
  timestamp?: number;
}

interface SyncState {
  threads: Thread[];
  messages: Record<string, Message[]>;
  selectedThreadId: string | null;
  isOnline: boolean;
  pendingOperations: any[];
  isLoading: boolean;
  error: string | null;
}

type SyncAction = 
  | { type: 'SET_THREADS'; payload: Thread[] }
  | { type: 'SET_MESSAGES'; payload: { threadId: string; messages: Message[] } }
  | { type: 'ADD_OPTIMISTIC_THREAD'; payload: Thread }
  | { type: 'ADD_OPTIMISTIC_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<Message> } }
  | { type: 'SELECT_THREAD'; payload: string | null }
  | { type: 'SET_ONLINE'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'REMOVE_OPTIMISTIC'; payload: { type: 'thread' | 'message'; id: string } };

const initialState: SyncState = {
  threads: [],
  messages: {},
  selectedThreadId: null,
  isOnline: true,
  pendingOperations: [],
  isLoading: false,
  error: null,
};

function syncReducer(state: SyncState, action: SyncAction): SyncState {
  switch (action.type) {
    case 'SET_THREADS':
      return {
        ...state,
        threads: action.payload.sort((a, b) => b.lastMessageAt - a.lastMessageAt),
      };
    
    case 'SET_MESSAGES':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.threadId]: action.payload.messages,
        },
      };
    
    case 'ADD_OPTIMISTIC_THREAD':
      return {
        ...state,
        threads: [action.payload, ...state.threads],
      };
    
    case 'ADD_OPTIMISTIC_MESSAGE':
      const threadId = action.payload.threadId;
      const existingMessages = state.messages[threadId] || [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [threadId]: [...existingMessages, action.payload],
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
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };
    
    case 'REMOVE_OPTIMISTIC':
      if (action.payload.type === 'thread') {
        return {
          ...state,
          threads: state.threads.filter(t => t._id !== action.payload.id),
        };
      } else {
        const threadId = Object.keys(state.messages).find(tId =>
          state.messages[tId].some(m => m._id === action.payload.id)
        );
        
        if (!threadId) return state;
        
        return {
          ...state,
          messages: {
            ...state.messages,
            [threadId]: state.messages[threadId].filter(m => m._id !== action.payload.id),
          },
        };
      }
    
    default:
      return state;
  }
}

interface SyncContextType {
  state: SyncState;
  actions: {
    selectThread: (threadId: string | null) => void;
    createThread: (title?: string) => Promise<string>;
    sendMessage: (content: string, provider?: string, model?: string) => Promise<void>;
    updateMessage: (id: string, updates: Partial<Message>) => void;
  };
}

const SyncContext = createContext<SyncContextType | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(syncReducer, initialState);
  
  // Convex queries and mutations
  const threads = useQuery(api.threads.list) || [];
  const createThreadMutation = useMutation(api.threads.create);
  const selectedMessages = useQuery(
    api.messages.list,
    state.selectedThreadId ? { threadId: state.selectedThreadId as Id<"threads"> } : "skip"
  ) || [];

  // Sync threads from Convex
  useEffect(() => {
    if (threads) {
      dispatch({ type: 'SET_THREADS', payload: threads });
    }
  }, [threads]);

  // Sync messages from Convex
  useEffect(() => {
    if (state.selectedThreadId && selectedMessages) {
      dispatch({
        type: 'SET_MESSAGES',
        payload: { threadId: state.selectedThreadId, messages: selectedMessages },
      });
    }
  }, [selectedMessages, state.selectedThreadId]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_ONLINE', payload: true });
    const handleOffline = () => dispatch({ type: 'SET_ONLINE', payload: false });
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Persist selected thread to localStorage
  useEffect(() => {
    if (state.selectedThreadId) {
      localStorage.setItem('c3chat_selected_thread', state.selectedThreadId);
    }
  }, [state.selectedThreadId]);

  // Restore selected thread from localStorage
  useEffect(() => {
    const savedThreadId = localStorage.getItem('c3chat_selected_thread');
    if (savedThreadId && !state.selectedThreadId) {
      dispatch({ type: 'SELECT_THREAD', payload: savedThreadId });
    }
  }, []);

  const actions = useMemo(() => ({
    selectThread: (threadId: string | null) => {
      dispatch({ type: 'SELECT_THREAD', payload: threadId });
    },

    createThread: async (title?: string): Promise<string> => {
      // Generate auto title if not provided
      const autoTitle = title || `Chat ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      
      // Optimistic update
      const optimisticId = `optimistic_${Date.now()}` as Id<"threads">;
      const optimisticThread: Thread = {
        _id: optimisticId,
        title: autoTitle,
        userId: "user" as Id<"users">,
        lastMessageAt: Date.now(),
        isOptimistic: true,
        isLoading: true,
      };
      
      dispatch({ type: 'ADD_OPTIMISTIC_THREAD', payload: optimisticThread });
      dispatch({ type: 'SELECT_THREAD', payload: optimisticId });
      
      try {
        const realThreadId = await createThreadMutation({ title: autoTitle });
        
        // Remove optimistic thread
        dispatch({ type: 'REMOVE_OPTIMISTIC', payload: { type: 'thread', id: optimisticId } });
        
        // Select real thread
        dispatch({ type: 'SELECT_THREAD', payload: realThreadId });
        
        return realThreadId;
      } catch (error) {
        // Remove optimistic thread on error
        dispatch({ type: 'REMOVE_OPTIMISTIC', payload: { type: 'thread', id: optimisticId } });
        throw error;
      }
    },

    sendMessage: async (content: string, provider = "openai", model = "gpt-4o-mini") => {
      if (!state.selectedThreadId) return;
      
      // Optimistic user message
      const optimisticUserMessage: Message = {
        _id: `optimistic_user_${Date.now()}` as Id<"messages">,
        threadId: state.selectedThreadId as Id<"threads">,
        role: "user",
        content,
        timestamp: Date.now(),
        isOptimistic: true,
      };
      
      dispatch({ type: 'ADD_OPTIMISTIC_MESSAGE', payload: optimisticUserMessage });
      
      // Optimistic assistant message with cursor
      const optimisticAssistantMessage: Message = {
        _id: `optimistic_assistant_${Date.now()}` as Id<"messages">,
        threadId: state.selectedThreadId as Id<"threads">,
        role: "assistant",
        content: "",
        isStreaming: true,
        cursor: true,
        timestamp: Date.now() + 1,
        isOptimistic: true,
      };
      
      dispatch({ type: 'ADD_OPTIMISTIC_MESSAGE', payload: optimisticAssistantMessage });
      
      // The actual AI call will be handled by the ChatInterface component
      // This is just for optimistic UI updates
    },

    updateMessage: (id: string, updates: Partial<Message>) => {
      dispatch({ type: 'UPDATE_MESSAGE', payload: { id, updates } });
    },
  }), [state.selectedThreadId, createThreadMutation]);

  const contextValue = useMemo(() => ({
    state,
    actions,
  }), [state, actions]);

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

// Convenience hooks
export function useThreads() {
  const { state } = useSync();
  return state.threads;
}

export function useMessages(threadId?: string) {
  const { state } = useSync();
  const targetThreadId = threadId || state.selectedThreadId;
  return targetThreadId ? state.messages[targetThreadId] || [] : [];
}

export function useSelectedThread() {
  const { state } = useSync();
  return state.threads.find(t => t._id === state.selectedThreadId) || null;
}

export function useOnlineStatus() {
  const { state } = useSync();
  return state.isOnline;
}
