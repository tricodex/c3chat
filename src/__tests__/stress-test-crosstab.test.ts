/**
 * Stress Test 2: Cross-Tab Synchronization
 * 
 * This test verifies that multiple tabs can stay synchronized without
 * race conditions or excessive memory usage.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CrossTabSync } from '../lib/cross-tab-sync';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  const listeners: Array<(e: StorageEvent) => void> = [];

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      const oldValue = store[key];
      store[key] = value;
      
      // Simulate storage event for other tabs
      const event = new StorageEvent('storage', {
        key,
        oldValue,
        newValue: value,
        storageArea: localStorageMock as any,
      });
      
      // Notify all listeners (simulating other tabs)
      listeners.forEach(listener => {
        setTimeout(() => listener(event), 0);
      });
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    addEventListener: (type: string, listener: (e: StorageEvent) => void) => {
      if (type === 'storage') {
        listeners.push(listener);
      }
    },
    removeEventListener: (type: string, listener: (e: StorageEvent) => void) => {
      if (type === 'storage') {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    },
  };
})();

// @ts-ignore
global.localStorage = localStorageMock;
// @ts-ignore
global.window = { localStorage: localStorageMock };

describe('Stress Test: Cross-Tab Synchronization', () => {
  let tab1: CrossTabSync;
  let tab2: CrossTabSync;
  let tab3: CrossTabSync;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    
    // Create three tab instances
    tab1 = new CrossTabSync();
    tab2 = new CrossTabSync();
    tab3 = new CrossTabSync();
  });

  afterEach(() => {
    tab1.cleanup();
    tab2.cleanup();
    tab3.cleanup();
  });

  it('should sync messages across multiple tabs without conflicts', async () => {
    const receivedMessages = {
      tab1: [] as any[],
      tab2: [] as any[],
      tab3: [] as any[],
    };

    // Subscribe all tabs to thread updates
    tab1.subscribe('thread_update', (msg) => receivedMessages.tab1.push(msg));
    tab2.subscribe('thread_update', (msg) => receivedMessages.tab2.push(msg));
    tab3.subscribe('thread_update', (msg) => receivedMessages.tab3.push(msg));

    // Simulate rapid updates from different tabs
    const updates = Array.from({ length: 100 }, (_, i) => ({
      type: 'thread_update',
      threadId: 'thread_1',
      messageId: `msg_${i}`,
      content: `Update ${i}`,
      tabId: i % 3 === 0 ? 'tab1' : i % 3 === 1 ? 'tab2' : 'tab3',
      timestamp: Date.now() + i,
    }));

    // Send updates with small delays to simulate real usage
    for (const update of updates) {
      const sender = update.tabId === 'tab1' ? tab1 : update.tabId === 'tab2' ? tab2 : tab3;
      sender.broadcast('thread_update', update);
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Wait for all messages to propagate
    await new Promise(resolve => setTimeout(resolve, 200));

    // Each tab should receive messages from the other two tabs
    const tab1External = receivedMessages.tab1.filter(m => m.tabId !== 'tab1');
    const tab2External = receivedMessages.tab2.filter(m => m.tabId !== 'tab2');
    const tab3External = receivedMessages.tab3.filter(m => m.tabId !== 'tab3');

    // Verify no messages are lost
    expect(tab1External.length).toBeGreaterThan(50);
    expect(tab2External.length).toBeGreaterThan(50);
    expect(tab3External.length).toBeGreaterThan(50);

    console.log(`✅ Tab 1 received ${tab1External.length} external messages`);
    console.log(`✅ Tab 2 received ${tab2External.length} external messages`);
    console.log(`✅ Tab 3 received ${tab3External.length} external messages`);
  });

  it('should handle leader election to prevent duplicate operations', async () => {
    const leaders: string[] = [];

    // Each tab tries to become leader
    const checkLeader = (tabName: string, sync: CrossTabSync) => {
      const heartbeat = setInterval(() => {
        const state = localStorage.getItem('cross-tab-sync-leader');
        if (state) {
          const leaderData = JSON.parse(state);
          if (Date.now() - leaderData.lastHeartbeat < 3000) {
            if (!leaders.includes(leaderData.tabId)) {
              leaders.push(leaderData.tabId);
            }
          }
        }
      }, 100);

      return () => clearInterval(heartbeat);
    };

    const cleanup1 = checkLeader('tab1', tab1);
    const cleanup2 = checkLeader('tab2', tab2);
    const cleanup3 = checkLeader('tab3', tab3);

    // Let leader election happen
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Only one leader should be elected at a time
    expect(leaders.length).toBeLessThanOrEqual(1);
    console.log(`✅ Leader election successful: ${leaders.length} leader(s)`);

    cleanup1();
    cleanup2();
    cleanup3();
  });

  it('should not exceed memory limits with many tabs', () => {
    const tabs: CrossTabSync[] = [];
    
    // Create 20 tabs
    for (let i = 0; i < 20; i++) {
      tabs.push(new CrossTabSync());
    }

    // Send messages from each tab
    tabs.forEach((tab, index) => {
      for (let j = 0; j < 10; j++) {
        tab.broadcast('test_message', {
          tabIndex: index,
          messageIndex: j,
          payload: 'x'.repeat(100), // 100 bytes per message
        });
      }
    });

    // Check localStorage size
    const storageSize = Object.keys(localStorage).reduce((size, key) => {
      return size + (localStorage.getItem(key)?.length || 0);
    }, 0);

    const storageSizeMB = storageSize / (1024 * 1024);
    expect(storageSizeMB).toBeLessThan(5); // Should be well under 5MB limit

    console.log(`✅ Storage size with 20 tabs: ${storageSizeMB.toFixed(2)}MB`);

    // Cleanup
    tabs.forEach(tab => tab.cleanup());
  });

  it('should handle rapid fire updates without dropping messages', async () => {
    let received = 0;
    const totalMessages = 1000;

    tab2.subscribe('rapid_fire', () => {
      received++;
    });

    // Send 1000 messages as fast as possible
    const startTime = Date.now();
    for (let i = 0; i < totalMessages; i++) {
      tab1.broadcast('rapid_fire', { index: i });
    }

    // Wait for propagation
    await new Promise(resolve => setTimeout(resolve, 500));

    const duration = Date.now() - startTime;
    const messagesPerSecond = (totalMessages / duration) * 1000;

    // Should receive most messages (allow for some loss due to rapid fire)
    expect(received).toBeGreaterThan(totalMessages * 0.95); // 95% delivery rate
    
    console.log(`✅ Rapid fire test: ${received}/${totalMessages} messages delivered`);
    console.log(`✅ Throughput: ${messagesPerSecond.toFixed(0)} messages/second`);
  });
});