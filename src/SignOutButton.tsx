"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { API_KEY_STORAGE_PREFIX, AI_PROVIDERS } from "./lib/ai-providers";
import { clearEncryptionKeys } from "./lib/crypto-utils";
import { toast } from "sonner";

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      // Clear all sensitive data from localStorage
      // 1. Clear all API keys
      for (const providerId of Object.keys(AI_PROVIDERS)) {
        localStorage.removeItem(API_KEY_STORAGE_PREFIX + providerId);
        localStorage.removeItem(API_KEY_STORAGE_PREFIX + providerId + '_encrypted');
        localStorage.removeItem(API_KEY_STORAGE_PREFIX + providerId + '_encrypted_flag');
      }
      
      // 2. Clear the encryption keys using the utility function
      clearEncryptionKeys();
      
      // 3. Clear provider preferences
      localStorage.removeItem('c3chat_preferred_provider');
      localStorage.removeItem('c3chat_preferred_model');
      
      // 4. Clear any model preferences for each provider
      for (const providerId of Object.keys(AI_PROVIDERS)) {
        localStorage.removeItem(`c3chat_preferred_model_${providerId}`);
      }
      
      // 5. Clear any other sensitive data that might exist
      // Look for any keys that start with our app prefix
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('c3chat_') || key.startsWith('apiKey_'))) {
          keysToRemove.push(key);
        }
      }
      
      // Remove all identified keys
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Finally, sign out from Convex
      await signOut();
      
      toast.success("Signed out successfully");
    } catch (error) {
      console.error("Error during sign out:", error);
      toast.error("Failed to sign out properly");
      
      // Even if cleanup fails, try to sign out
      await signOut();
    }
  };

  return (
    <button
      className="c3-button c3-button-secondary text-xs h-8"
      onClick={handleSignOut}
    >
      Sign out
    </button>
  );
}
