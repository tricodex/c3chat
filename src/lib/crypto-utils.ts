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

// Generate or retrieve a persistent encryption key
async function getUserKey(): Promise<string> {
  const STORAGE_KEY = 'c3chat_encryption_key_v2';
  
  // Try to get existing key from localStorage
  const existingKey = localStorage.getItem(STORAGE_KEY);
  if (existingKey) {
    return existingKey;
  }
  
  // Generate a new random key if none exists
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const newKey = btoa(String.fromCharCode(...randomBytes));
  
  // Store for future use
  localStorage.setItem(STORAGE_KEY, newKey);
  
  // Also create a backup using browser fingerprint for migration
  const fingerprint = generateBrowserFingerprint();
  localStorage.setItem(`${STORAGE_KEY}_fingerprint`, fingerprint);
  
  return newKey;
}

// Generate browser fingerprint for fallback/migration
function generateBrowserFingerprint(): string {
  const userAgent = navigator.userAgent;
  const language = navigator.language;
  const platform = navigator.platform;
  const screenResolution = `${screen.width}x${screen.height}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
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
    
    // Derive key from persistent user key
    const userKey = await getUserKey();
    const key = await deriveKey(userKey, salt);
    
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
    const userKey = await getUserKey();
    const key = await deriveKey(userKey, salt);
    
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

// Migrate encrypted data from old fingerprint-based key to new persistent key
export async function migrateEncryptedData(encryptedBase64: string): Promise<string | null> {
  try {
    // First try to decrypt with current key
    const decrypted = await decryptData(encryptedBase64);
    return decrypted;
  } catch (error) {
    console.log('Failed with current key, trying fingerprint-based migration...');
    
    try {
      // Try to decrypt with fingerprint-based key
      const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 28);
      const encryptedData = combined.slice(28);
      
      // Use the old fingerprint method
      const fingerprint = generateBrowserFingerprint();
      const key = await deriveKey(fingerprint, salt);
      
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedData
      );
      
      const decoder = new TextDecoder();
      const decryptedText = decoder.decode(decryptedData);
      
      // Re-encrypt with new persistent key
      const reencrypted = await encryptData(decryptedText);
      
      console.log('Successfully migrated encrypted data to persistent key');
      return decryptedText;
    } catch (migrationError) {
      console.error('Migration failed:', migrationError);
      return null;
    }
  }
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
      
      // Try to decrypt, with migration fallback
      const decrypted = await migrateEncryptedData(encrypted);
      
      // If migration happened, update storage with new encryption
      if (decrypted !== null) {
        try {
          const currentDecrypted = await decryptData(encrypted);
          // If we can decrypt with current key, no migration needed
        } catch {
          // Migration was needed, update storage
          const reencrypted = await encryptData(decrypted);
          localStorage.setItem(key + '_encrypted', reencrypted);
        }
      }
      
      return decrypted;
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