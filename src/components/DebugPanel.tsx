import { useEffect, useState } from 'react';
import { useEnhancedSync } from '../lib/sync-engine-switcher';
import { getRedisCache } from '../lib/redis-cache';

export function DebugPanel() {
  const { state } = useEnhancedSync();
  const [redisInfo, setRedisInfo] = useState<any>(null);
  
  useEffect(() => {
    const checkRedis = async () => {
      try {
        const cache = getRedisCache();
        const info = await cache.getStorageInfo();
        setRedisInfo(info);
        
        // Try to get viewport
        if (state.selectedThreadId) {
          const viewport = await cache.getViewport(state.selectedThreadId);
          console.log('Debug Panel - Viewport:', viewport);
        }
      } catch (error) {
        console.error('Debug Panel - Error:', error);
      }
    };
    
    checkRedis();
  }, [state.selectedThreadId]);
  
  if (!import.meta.env.DEV) return null;
  
  return (
    <div style={{
      position: 'fixed',
      bottom: 10,
      right: 10,
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <h4 style={{ margin: '0 0 5px 0' }}>🐛 Debug Panel</h4>
      <div>Thread: {state.selectedThreadId || 'none'}</div>
      <div>Viewport: {state.currentViewport ? `${state.currentViewport.messages.length} msgs` : 'not loaded'}</div>
      <div>Redis: {redisInfo ? 'Connected' : 'Not connected'}</div>
      <div>Memory cache: {redisInfo?.memoryCacheSize || 0} bytes</div>
    </div>
  );
}