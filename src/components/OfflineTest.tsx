/**
 * Component to test offline functionality
 * Shows pending operations and allows manual testing
 */

import React from 'react';
import { useEnhancedSync, useOfflineCapability } from '../lib/corrected-sync-engine';
import { WifiOff, Wifi, RefreshCw, Clock, CheckCircle, XCircle } from 'lucide-react';

export function OfflineTest() {
  const { state, actions } = useEnhancedSync();
  const { isOnline, pendingOperations, storageQuota, retryOperation } = useOfflineCapability();

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed bottom-4 right-4 bg-card rounded-lg shadow-lg p-4 w-80 max-h-96 overflow-y-auto">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        {isOnline ? (
          <Wifi className="h-5 w-5 text-green-500" />
        ) : (
          <WifiOff className="h-5 w-5 text-red-500" />
        )}
        Sync Status: {isOnline ? 'Online' : 'Offline'}
      </h3>

      {/* Storage Info */}
      {storageQuota && (
        <div className="mb-3 text-sm">
          <div className="flex justify-between">
            <span>Storage Used:</span>
            <span>{formatBytes(storageQuota.usage || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span>Storage Quota:</span>
            <span>{formatBytes(storageQuota.quota || 0)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{
                width: `${((storageQuota.usage || 0) / (storageQuota.quota || 1)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Pending Operations */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm">
          Pending Operations ({pendingOperations.length})
        </h4>
        {pendingOperations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending operations</p>
        ) : (
          pendingOperations.map((op) => (
            <div
              key={op.id}
              className="bg-muted p-2 rounded text-sm space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{op.type.replace(/_/g, ' ')}</span>
                <button
                  onClick={() => retryOperation(op.id)}
                  className="p-1 hover:bg-background rounded"
                  title="Retry operation"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{new Date(op.timestamp).toLocaleTimeString()}</span>
                {op.retryCount > 0 && (
                  <span className="text-orange-600">
                    Retries: {op.retryCount}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Sync Status */}
      {state.isSyncing && (
        <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Syncing...</span>
        </div>
      )}

      {/* Last Sync Time */}
      {state.lastSyncTime > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          Last sync: {new Date(state.lastSyncTime).toLocaleTimeString()}
        </div>
      )}

      {/* Error State */}
      {state.error && (
        <div className="mt-3 p-2 bg-red-50 text-red-600 rounded text-sm">
          {state.error}
        </div>
      )}

      {/* Test Actions */}
      <div className="mt-4 space-y-2">
        <button
          onClick={() => actions.createThread('Test Offline Thread')}
          className="w-full px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
        >
          Create Test Thread
        </button>
        <button
          onClick={() => actions.syncWithConvex()}
          className="w-full px-3 py-1 bg-secondary text-secondary-foreground rounded text-sm"
          disabled={!isOnline || state.isSyncing}
        >
          Force Sync
        </button>
      </div>
    </div>
  );
}