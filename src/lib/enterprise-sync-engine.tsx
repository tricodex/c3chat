/**
 * Enterprise Sync Engine for C3Chat
 * 
 * Enhanced features:
 * - Complete thread isolation to prevent message contamination
 * - Message branching and versioning
 * - Copy functionality for all messages
 * - Message editing and regeneration
 * - Robust thread management
 * 
 * Architecture:
 * - Thread-scoped message queries
 * - Version tracking for branching
 * - Immutable message history
 * - Optimistic updates with rollback
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api, internal } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { createLocalDB, LocalDB, StoredThread, StoredMessage } from './local-db';
import { nanoid } from 'nanoid';
import { getAgentSystemPrompt, getAgentTemperature } from './ai-agents';

// Enhanced types for enterprise features
interface Thread extends StoredThread {
  isOptimistic?: boolean;
  isPending?: boolean;
  _version?: number;
  _lastModified?: number;
  parentThreadId?: string; // For branching
  branchPoint?: string; // Message ID where branch occurred
}

interface Message extends StoredMessage {
  isOptimistic?: boolean;
  isPending?: boolean;
  _version?: number;
  parentMessageId?: string; // For message branching
  branches?: string[]; // IDs of branched messages
  isEdited?: boolean;
  editHistory?: MessageEdit[];
}

interface MessageEdit {
  timestamp: number;
  previousContent: string;
  editedBy: string;
}

interface EnterpriseSyncState {
  threads: Thread[];
  // Thread-scoped messages with strict isolation
  threadMessages: Map<string, Message[]>;
  selectedThreadId: string | null;
  selectedMessageId: string | null; // For branching
  isOnline: boolean;
  isInitialized: boolean;
  lastSyncTime: number;
  pendingOperations: PendingOperation[];
  error: string | null;
  isSyncing: boolean;
  operationLocks: Set<string>;
  // Enterprise features
  messageVersions: Map<string, Message[]>; // Message ID -> versions
  clipboardMessage: Message | null;
}

interface PendingOperation {
  id: string;
  type: 'create_thread' | 'update_thread' | 'delete_thread' | 
        'create_message' | 'update_message' | 'delete_message' |
        'branch_message' | 'edit_message';
  data: any;
  timestamp: number;
  retryCount: number;
  optimisticId?: string;
  realId?: string;
}

type EnterpriseSyncAction = 
  | { type: 'INITIALIZE'; payload: { threads: Thread[]; metadata: any; pendingOps?: PendingOperation[] } }
  | { type: 'SET_THREADS_FROM_CONVEX'; payload: Thread[] }
  | { type: 'SET_THREAD_MESSAGES'; payload: { threadId: string; messages: Message[] } }
  | { type: 'CLEAR_THREAD_MESSAGES'; payload: string }
  | { type: 'CLEAR_ALL_MESSAGES' }
  | { type: 'ADD_OPTIMISTIC_THREAD'; payload: Thread }
  | { type: 'UPDATE_OPTIMISTIC_THREAD'; payload: { id: string; updates: Partial<Thread> } }
  | { type: 'REMOVE_OPTIMISTIC_THREAD'; payload: string }
  | { type: 'REPLACE_OPTIMISTIC_THREAD'; payload: { optimisticId: string; realThread: Thread } }
  | { type: 'ADD_OPTIMISTIC_MESSAGE'; payload: { threadId: string; message: Message } }
  | { type: 'UPDATE_OPTIMISTIC_MESSAGE'; payload: { threadId: string; messageId: string; updates: Partial<Message> } }
  | { type: 'REMOVE_OPTIMISTIC_MESSAGE'; payload: { threadId: string; messageId: string } }
  | { type: 'SELECT_THREAD'; payload: string | null }
  | { type: 'SELECT_MESSAGE'; payload: string | null }
  | { type: 'SET_ONLINE'; payload: boolean }
  | { type: 'SET_SYNC_TIME'; payload: number }
  | { type: 'SET_SYNCING'; payload: boolean }
  | { type: 'ADD_PENDING_OPERATION'; payload: PendingOperation }
  | { type: 'UPDATE_PENDING_OPERATION'; payload: { id: string; updates: Partial<PendingOperation> } }
  | { type: 'REMOVE_PENDING_OPERATION'; payload: string }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ACQUIRE_LOCK'; payload: string }
  | { type: 'RELEASE_LOCK'; payload: string }
  | { type: 'COPY_MESSAGE'; payload: Message }
  | { type: 'ADD_MESSAGE_VERSION'; payload: { messageId: string; version: Message } }
  | { type: 'ADD_MESSAGE_BRANCH'; payload: { messageId: string; branchId: string } };

const initialState: EnterpriseSyncState = {
  threads: [],
  threadMessages: new Map(),
  selectedThreadId: null,
  selectedMessageId: null,
  isOnline: navigator.onLine,
  isInitialized: false,
  lastSyncTime: 0,
  pendingOperations: [],
  error: null,
  isSyncing: false,
  operationLocks: new Set(),
  messageVersions: new Map(),
  clipboardMessage: null,
};

// Enhanced reducer with strict thread isolation
function enterpriseSyncReducer(state: EnterpriseSyncState, action: EnterpriseSyncAction): EnterpriseSyncState {
  switch (action.type) {
    case 'INITIALIZE':
      return {
        ...state,
        threads: action.payload.threads,
        selectedThreadId: action.payload.metadata.selectedThreadId || null,
        lastSyncTime: action.payload.metadata.lastSyncTime || 0,
        pendingOperations: action.payload.pendingOps || [],
        isInitialized: true,
      };

    case 'SET_THREADS_FROM_CONVEX':
      const convexThreads = action.payload;
      const optimisticThreads = state.threads.filter(t => t.isOptimistic);
      
      const mergedThreads = [...convexThreads, ...optimisticThreads]
        .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      
      return {
        ...state,
        threads: mergedThreads,
      };

    case 'SET_THREAD_MESSAGES':
      // Strict thread isolation - only update messages for the specific thread
      const newThreadMessages = new Map(state.threadMessages);
      newThreadMessages.set(action.payload.threadId, action.payload.messages);
      
      return {
        ...state,
        threadMessages: newThreadMessages,
      };

    case 'CLEAR_THREAD_MESSAGES':
      const clearedThreadMessages = new Map(state.threadMessages);
      clearedThreadMessages.delete(action.payload);
      
      return {
        ...state,
        threadMessages: clearedThreadMessages,
      };

    case 'CLEAR_ALL_MESSAGES':
      return {
        ...state,
        threadMessages: new Map(),
      };

    case 'ADD_OPTIMISTIC_MESSAGE':
      const { threadId, message } = action.payload;
      const currentMessages = state.threadMessages.get(threadId) || [];
      const updatedMessages = [...currentMessages, message]
        .sort((a, b) => (a.localCreatedAt || 0) - (b.localCreatedAt || 0));
      
      const updatedThreadMessages = new Map(state.threadMessages);
      updatedThreadMessages.set(threadId, updatedMessages);
      
      return {
        ...state,
        threadMessages: updatedThreadMessages,
      };

    case 'UPDATE_OPTIMISTIC_MESSAGE':
      const msgThreadMessages = state.threadMessages.get(action.payload.threadId) || [];
      const updatedMsgMessages = msgThreadMessages.map(m =>
        m._id === action.payload.messageId 
          ? { ...m, ...action.payload.updates, _version: (m._version || 0) + 1 }
          : m
      );
      
      const newMsgThreadMessages = new Map(state.threadMessages);
      newMsgThreadMessages.set(action.payload.threadId, updatedMsgMessages);
      
      return {
        ...state,
        threadMessages: newMsgThreadMessages,
      };

    case 'REMOVE_OPTIMISTIC_MESSAGE':
      const rmThreadMessages = state.threadMessages.get(action.payload.threadId) || [];
      const filteredMessages = rmThreadMessages.filter(m => m._id !== action.payload.messageId);
      
      const newRmThreadMessages = new Map(state.threadMessages);
      newRmThreadMessages.set(action.payload.threadId, filteredMessages);
      
      return {
        ...state,
        threadMessages: newRmThreadMessages,
      };

    case 'SELECT_THREAD':
      // Clear all messages when switching threads for complete isolation
      if (action.payload !== state.selectedThreadId) {
        return {
          ...state,
          selectedThreadId: action.payload,
          selectedMessageId: null,
          threadMessages: new Map(), // Clear all cached messages
        };
      }
      return {
        ...state,
        selectedThreadId: action.payload,
      };

    case 'SELECT_MESSAGE':
      return {
        ...state,
        selectedMessageId: action.payload,
      };

    case 'COPY_MESSAGE':
      return {
        ...state,
        clipboardMessage: action.payload,
      };

    case 'ADD_MESSAGE_VERSION':
      const versions = state.messageVersions.get(action.payload.messageId) || [];
      const newVersions = new Map(state.messageVersions);
      newVersions.set(action.payload.messageId, [...versions, action.payload.version]);
      
      return {
        ...state,
        messageVersions: newVersions,
      };

    case 'ADD_MESSAGE_BRANCH':
      const threadMsgs = state.threadMessages.get(state.selectedThreadId || '') || [];
      const branchedMessages = threadMsgs.map(m => {
        if (m._id === action.payload.messageId) {
          return {
            ...m,
            branches: [...(m.branches || []), action.payload.branchId],
          };
        }
        return m;
      });
      
      const branchThreadMessages = new Map(state.threadMessages);
      if (state.selectedThreadId) {
        branchThreadMessages.set(state.selectedThreadId, branchedMessages);
      }
      
      return {
        ...state,
        threadMessages: branchThreadMessages,
      };

    // ... other cases remain similar with Map operations
    default:
      return state;
  }
}

// Context
const EnterpriseSyncContext = createContext<{
  state: EnterpriseSyncState;
  actions: EnterpriseActions;
  localDB: React.RefObject<LocalDB | null>;
} | null>(null);

// Enhanced hooks
export const useEnterpriseSync = () => {
  const context = useContext(EnterpriseSyncContext);
  if (!context) {
    throw new Error('useEnterpriseSync must be used within EnterpriseSyncProvider');
  }
  return context;
};

export const useThreads = () => {
  const { state } = useEnterpriseSync();
  return state.threads;
};

export const useMessages = (threadId?: string) => {
  const { state } = useEnterpriseSync();
  const id = threadId || state.selectedThreadId;
  
  // Strict thread isolation - only return messages for the exact thread
  if (id) {
    return state.threadMessages.get(id) || [];
  }
  
  return [];
};

export const useSelectedThread = () => {
  const { state } = useEnterpriseSync();
  return state.threads.find(t => t._id === state.selectedThreadId) || null;
};

export const useOnlineStatus = () => {
  const { state } = useEnterpriseSync();
  return state.isOnline;
};

export const useSyncStatus = () => {
  const { state } = useEnterpriseSync();
  return {
    isSyncing: state.isSyncing,
    lastSyncTime: state.lastSyncTime,
    hasError: !!state.error,
    error: state.error,
  };
};

// Enterprise actions interface
interface EnterpriseActions {
  // Thread management
  selectThread: (threadId: string | null) => Promise<void>;
  createThread: (title?: string, provider?: string, model?: string) => Promise<string>;
  updateThread: (threadId: string, updates: Partial<Thread>) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
  
  // Message management
  sendMessage: (content: string, threadId: string, provider: string, model: string, apiKey?: string, attachmentIds?: Id<"attachments">[], agentId?: string) => Promise<void>;
  updateMessage: (messageId: string, updates: Partial<Message>) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  
  // Enterprise features
  copyMessage: (message: Message) => void;
  branchMessage: (messageId: string, threadId: string) => Promise<string>;
  editMessage: (messageId: string, newContent: string, threadId: string) => Promise<void>;
  regenerateMessage: (messageId: string, threadId: string) => Promise<void>;
  createBranch: (threadId: string, messageId?: string, title?: string) => Promise<string>;
  
  // Advanced features
  exportThread: (threadId: string, format?: string) => Promise<void>;
  clearThread: (threadId: string) => Promise<void>;
  sendSystemMessage: (content: string, threadId: string) => Promise<void>;
  generateImage: (prompt: string, threadId: string) => Promise<void>;
  sendMessageWithSearch: (content: string, threadId: string, provider: string, model: string, apiKey?: string, searchQueries?: string[], attachmentIds?: Id<"attachments">[], agentId?: string) => Promise<void>;
  
  // Offline support
  retryOperation: (operationId: string) => Promise<void>;
}

// Provider component will follow...