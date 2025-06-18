/**
 * Crypto utilities for secure API key storage
 * Uses Web Crypto API for browser-native encryption
 */

// Derive a key from a passphrase using PBKDF2
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passphraseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Generate a unique key for each user/browser combination
function getUserKey(): string {
  // Combine multiple browser fingerprints for uniqueness
  const userAgent = navigator.userAgent;
  const language = navigator.language;
  const platform = navigator.platform;
  const screenResolution = `${screen.width}x${screen.height}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Create a unique browser fingerprint
  return `${userAgent}-${language}-${platform}-${screenResolution}-${timezone}`;
}

// Encrypt data using AES-GCM
export async function encryptData(plaintext: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    
    // Generate a random salt and IV for each encryption
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Derive key from browser fingerprint
    const key = await deriveKey(getUserKey(), salt);
    
    // Encrypt the data
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    // Combine salt, iv, and encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encryptedData), salt.length + iv.length);
    
    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

// Decrypt data using AES-GCM
export async function decryptData(encryptedBase64: string): Promise<string> {
  try {
    // Convert from base64
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    
    // Extract salt, iv, and encrypted data
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encryptedData = combined.slice(28);
    
    // Derive the same key
    const key = await deriveKey(getUserKey(), salt);
    
    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
    
    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

// Check if Web Crypto API is available
export function isCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && 
         typeof crypto.subtle !== 'undefined' &&
         typeof crypto.getRandomValues === 'function';
}

// Secure storage wrapper with automatic encryption/decryption
export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    if (!isCryptoAvailable()) {
      console.warn('Web Crypto API not available, falling back to plain storage');
      localStorage.setItem(key, value);
      return;
    }
    
    try {
      const encrypted = await encryptData(value);
      localStorage.setItem(key + '_encrypted', encrypted);
      // Store a flag to indicate this key is encrypted
      localStorage.setItem(key + '_encrypted_flag', 'true');
    } catch (error) {
      console.error('Encryption failed, storing in plain text:', error);
      localStorage.setItem(key, value);
    }
  },
  
  async getItem(key: string): Promise<string | null> {
    // Check if the key is encrypted
    const isEncrypted = localStorage.getItem(key + '_encrypted_flag') === 'true';
    
    if (!isEncrypted) {
      // Return plain text value if it exists
      return localStorage.getItem(key);
    }
    
    if (!isCryptoAvailable()) {
      console.warn('Web Crypto API not available, cannot decrypt');
      return null;
    }
    
    try {
      const encrypted = localStorage.getItem(key + '_encrypted');
      if (!encrypted) return null;
      
      return await decryptData(encrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      // Try to return plain text as fallback
      return localStorage.getItem(key);
    }
  },
  
  removeItem(key: string): void {
    localStorage.removeItem(key);
    localStorage.removeItem(key + '_encrypted');
    localStorage.removeItem(key + '_encrypted_flag');
  },
  
  // Migrate existing plain text keys to encrypted storage
  async migrateKey(key: string): Promise<void> {
    const plainValue = localStorage.getItem(key);
    if (plainValue && !localStorage.getItem(key + '_encrypted_flag')) {
      await this.setItem(key, plainValue);
      // Only remove the plain key after successful encryption
      if (localStorage.getItem(key + '_encrypted_flag') === 'true') {
        localStorage.removeItem(key);
      }
    }
  }
};