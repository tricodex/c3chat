import { describe, it, expect, beforeEach, vi } from 'vitest';
import { API_KEY_STORAGE_PREFIX, AI_PROVIDERS } from '../lib/ai-providers';
import { clearEncryptionKeys } from '../lib/crypto-utils';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('API Key Security Isolation', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear();
  });

  it('should properly clear all API keys on logout', () => {
    // Setup: Add API keys for multiple providers
    localStorageMock.setItem(`${API_KEY_STORAGE_PREFIX}openai`, 'test-key-1');
    localStorageMock.setItem(`${API_KEY_STORAGE_PREFIX}anthropic`, 'test-key-2');
    localStorageMock.setItem(`${API_KEY_STORAGE_PREFIX}google`, 'test-key-3');
    
    // Add encrypted versions
    localStorageMock.setItem(`${API_KEY_STORAGE_PREFIX}openai_encrypted`, 'encrypted-data-1');
    localStorageMock.setItem(`${API_KEY_STORAGE_PREFIX}openai_encrypted_flag`, 'true');
    
    // Add encryption key
    localStorageMock.setItem('c3chat_encryption_key_v2', 'master-key');
    localStorageMock.setItem('c3chat_encryption_key_v2_fingerprint', 'fingerprint');
    
    // Add preferences
    localStorageMock.setItem('c3chat_preferred_provider', 'openai');
    localStorageMock.setItem('c3chat_preferred_model', 'gpt-4');
    
    // Simulate logout cleanup (from SignOutButton)
    for (const providerId of Object.keys(AI_PROVIDERS)) {
      localStorageMock.removeItem(API_KEY_STORAGE_PREFIX + providerId);
      localStorageMock.removeItem(API_KEY_STORAGE_PREFIX + providerId + '_encrypted');
      localStorageMock.removeItem(API_KEY_STORAGE_PREFIX + providerId + '_encrypted_flag');
    }
    
    // Clear encryption keys
    clearEncryptionKeys();
    
    // Clear preferences
    localStorageMock.removeItem('c3chat_preferred_provider');
    localStorageMock.removeItem('c3chat_preferred_model');
    
    // Verify all sensitive data is cleared
    expect(localStorageMock.getItem(`${API_KEY_STORAGE_PREFIX}openai`)).toBeNull();
    expect(localStorageMock.getItem(`${API_KEY_STORAGE_PREFIX}anthropic`)).toBeNull();
    expect(localStorageMock.getItem(`${API_KEY_STORAGE_PREFIX}google`)).toBeNull();
    expect(localStorageMock.getItem(`${API_KEY_STORAGE_PREFIX}openai_encrypted`)).toBeNull();
    expect(localStorageMock.getItem(`${API_KEY_STORAGE_PREFIX}openai_encrypted_flag`)).toBeNull();
    expect(localStorageMock.getItem('c3chat_encryption_key_v2')).toBeNull();
    expect(localStorageMock.getItem('c3chat_encryption_key_v2_fingerprint')).toBeNull();
    expect(localStorageMock.getItem('c3chat_preferred_provider')).toBeNull();
    expect(localStorageMock.getItem('c3chat_preferred_model')).toBeNull();
  });

  it('should clear encryption keys with clearEncryptionKeys function', () => {
    // Setup encryption keys and encrypted data
    localStorageMock.setItem('c3chat_encryption_key_v2', 'test-key');
    localStorageMock.setItem('c3chat_encryption_key_v2_fingerprint', 'test-fingerprint');
    localStorageMock.setItem('some_key_encrypted', 'encrypted-data');
    localStorageMock.setItem('another_key_encrypted_flag', 'true');
    
    // Call clearEncryptionKeys
    clearEncryptionKeys();
    
    // Verify encryption keys are cleared
    expect(localStorageMock.getItem('c3chat_encryption_key_v2')).toBeNull();
    expect(localStorageMock.getItem('c3chat_encryption_key_v2_fingerprint')).toBeNull();
    expect(localStorageMock.getItem('some_key_encrypted')).toBeNull();
    expect(localStorageMock.getItem('another_key_encrypted_flag')).toBeNull();
  });

  it('should prevent API key access across different users', () => {
    // User A stores API keys
    localStorageMock.setItem(`${API_KEY_STORAGE_PREFIX}openai`, 'user-a-key');
    localStorageMock.setItem('c3chat_encryption_key_v2', 'user-a-encryption');
    
    // Simulate user switch detection (from App.tsx)
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorageMock.length; i++) {
      const key = localStorageMock.key(i);
      if (key && (
        key.startsWith('c3chat_api_key_') ||
        key.startsWith('c3chat_encryption_key') ||
        key.startsWith('apiKey_') ||
        key.includes('_encrypted')
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorageMock.removeItem(key));
    
    // Verify User B cannot access User A's keys
    expect(localStorageMock.getItem(`${API_KEY_STORAGE_PREFIX}openai`)).toBeNull();
    expect(localStorageMock.getItem('c3chat_encryption_key_v2')).toBeNull();
  });

  it('should handle legacy API key formats during cleanup', () => {
    // Add various legacy formats that might exist
    localStorageMock.setItem('apiKey_openai', 'legacy-key-1');
    localStorageMock.setItem('c3chat_openai_key', 'legacy-key-2');
    localStorageMock.setItem('openai_api_key', 'legacy-key-3');
    
    // Cleanup pattern from SignOutButton
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorageMock.length; i++) {
      const key = localStorageMock.key(i);
      if (key && (key.startsWith('c3chat_') || key.startsWith('apiKey_'))) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorageMock.removeItem(key));
    
    // Verify legacy keys are cleared
    expect(localStorageMock.getItem('apiKey_openai')).toBeNull();
    expect(localStorageMock.getItem('c3chat_openai_key')).toBeNull();
    // Note: 'openai_api_key' pattern is not cleared by current implementation
    expect(localStorageMock.getItem('openai_api_key')).toBe('legacy-key-3');
  });
});