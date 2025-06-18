/**
 * Cross-Tab Synchronization for C3Chat
 * 
 * This module provides cross-tab synchronization using localStorage and storage events.
 * It ensures that thread selection and other state is synchronized across browser tabs.
 */

import { Id } from '../../convex/_generated/dataModel';

export interface CrossTabMessage {
  type: 'thread_selected' | 'thread_created' | 'thread_deleted' | 'state_update';
  payload: any;
  timestamp: number;
  tabId: string;
}

export class CrossTabSync {
  private tabId: string;
  private listeners: Map<string, ((message: CrossTabMessage) => void)[]> = new Map();
  private storageKey = 'c3chat_crosstab_sync';
  private selectedThreadKey = 'c3chat_selected_thread';
  
  constructor() {
    this.tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.setupStorageListener();
  }
  
  private setupStorageListener() {
    if (typeof window === 'undefined') return;
    
    window.addEventListener('storage', (event) => {
      if (event.key === this.storageKey && event.newValue) {
        try {
          const message: CrossTabMessage = JSON.parse(event.newValue);
          
          // Don't process our own messages
          if (message.tabId === this.tabId) return;
          
          // Notify listeners
          const listeners = this.listeners.get(message.type) || [];
          listeners.forEach(listener => listener(message));
        } catch (error) {
          console.error('Failed to parse cross-tab message:', error);
        }
      }
    });
  }
  
  // Send a message to other tabs
  broadcast(type: CrossTabMessage['type'], payload: any) {
    if (typeof window === 'undefined') return;
    
    const message: CrossTabMessage = {
      type,
      payload,
      timestamp: Date.now(),
      tabId: this.tabId,
    };
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(message));
      
      // Clear after a short delay to prevent storage bloat
      setTimeout(() => {
        localStorage.removeItem(this.storageKey);
      }, 100);
    } catch (error) {
      console.error('Failed to broadcast cross-tab message:', error);
    }
  }
  
  // Subscribe to messages of a specific type
  subscribe(type: CrossTabMessage['type'], callback: (message: CrossTabMessage) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(type) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }
  
  // Thread selection persistence
  setSelectedThread(threadId: string | null) {
    if (typeof window === 'undefined') return;
    
    if (threadId) {
      localStorage.setItem(this.selectedThreadKey, threadId);
      this.broadcast('thread_selected', { threadId });
    } else {
      localStorage.removeItem(this.selectedThreadKey);
      this.broadcast('thread_selected', { threadId: null });
    }
  }
  
  getSelectedThread(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.selectedThreadKey);
  }
  
  // Clean up
  cleanup() {
    this.listeners.clear();
  }
}

// Singleton instance
let crossTabSyncInstance: CrossTabSync | null = null;

export function getCrossTabSync(): CrossTabSync {
  if (!crossTabSyncInstance) {
    crossTabSyncInstance = new CrossTabSync();
  }
  return crossTabSyncInstance;
}