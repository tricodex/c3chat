/**
 * Redis Integration Monitor
 * 
 * Real-time monitoring for the Redis integration to ensure it's working correctly
 */

import { getRedisCache } from './redis-cache';

export class RedisMonitor {
  private metrics = {
    viewportLoads: 0,
    viewportExpansions: 0,
    streamingUpdates: 0,
    lockAcquisitions: 0,
    lockFailures: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: [] as string[],
    memoryUsage: 0,
    redisOperations: 0,
  };
  
  private startTime = Date.now();
  private redisCache = getRedisCache();
  
  constructor() {
    this.instrumentRedisCache();
  }
  
  private instrumentRedisCache() {
    // Instrument getViewport
    const originalGetViewport = this.redisCache.getViewport.bind(this.redisCache);
    this.redisCache.getViewport = async (...args) => {
      this.metrics.viewportLoads++;
      this.metrics.redisOperations++;
      
      try {
        const result = await originalGetViewport(...args);
        if (result.messages.length > 0) {
          this.metrics.cacheHits++;
        } else {
          this.metrics.cacheMisses++;
        }
        return result;
      } catch (error) {
        this.metrics.errors.push(`getViewport: ${error}`);
        throw error;
      }
    };
    
    // Instrument expandViewport
    const originalExpandViewport = this.redisCache.expandViewport.bind(this.redisCache);
    this.redisCache.expandViewport = async (...args) => {
      this.metrics.viewportExpansions++;
      this.metrics.redisOperations++;
      
      try {
        return await originalExpandViewport(...args);
      } catch (error) {
        this.metrics.errors.push(`expandViewport: ${error}`);
        throw error;
      }
    };
    
    // Instrument updateStreamingMessage
    const originalUpdateStreaming = this.redisCache.updateStreamingMessage.bind(this.redisCache);
    this.redisCache.updateStreamingMessage = async (...args) => {
      this.metrics.streamingUpdates++;
      
      try {
        return await originalUpdateStreaming(...args);
      } catch (error) {
        this.metrics.errors.push(`updateStreamingMessage: ${error}`);
        throw error;
      }
    };
    
    // Instrument acquireLock
    const originalAcquireLock = this.redisCache.acquireLock.bind(this.redisCache);
    this.redisCache.acquireLock = async (...args) => {
      this.metrics.lockAcquisitions++;
      this.metrics.redisOperations++;
      
      try {
        const result = await originalAcquireLock(...args);
        if (!result) {
          this.metrics.lockFailures++;
        }
        return result;
      } catch (error) {
        this.metrics.errors.push(`acquireLock: ${error}`);
        this.metrics.lockFailures++;
        throw error;
      }
    };
  }
  
  async updateMemoryUsage() {
    try {
      const info = await this.redisCache.getStorageInfo();
      this.metrics.memoryUsage = info.memoryCacheSize;
    } catch (error) {
      console.error('Failed to get storage info:', error);
    }
  }
  
  getMetrics() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const opsPerSecond = this.metrics.redisOperations / uptime || 0;
    const cacheHitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0;
    const lockSuccessRate = (this.metrics.lockAcquisitions - this.metrics.lockFailures) / this.metrics.lockAcquisitions || 0;
    
    return {
      uptime,
      opsPerSecond: opsPerSecond.toFixed(2),
      cacheHitRate: (cacheHitRate * 100).toFixed(1) + '%',
      lockSuccessRate: (lockSuccessRate * 100).toFixed(1) + '%',
      memoryUsageMB: (this.metrics.memoryUsage / (1024 * 1024)).toFixed(2),
      ...this.metrics,
    };
  }
  
  printReport() {
    const metrics = this.getMetrics();
    
    console.log('\n📊 Redis Integration Monitor Report');
    console.log('===================================');
    console.log(`⏱️  Uptime: ${metrics.uptime}s`);
    console.log(`🚀 Operations/sec: ${metrics.opsPerSecond}`);
    console.log(`💾 Memory Usage: ${metrics.memoryUsageMB}MB`);
    console.log(`📖 Cache Hit Rate: ${metrics.cacheHitRate}`);
    console.log(`🔒 Lock Success Rate: ${metrics.lockSuccessRate}`);
    console.log('\n📈 Operation Counts:');
    console.log(`   - Viewport Loads: ${metrics.viewportLoads}`);
    console.log(`   - Viewport Expansions: ${metrics.viewportExpansions}`);
    console.log(`   - Streaming Updates: ${metrics.streamingUpdates}`);
    console.log(`   - Lock Operations: ${metrics.lockAcquisitions} (${metrics.lockFailures} failures)`);
    
    if (metrics.errors.length > 0) {
      console.log('\n❌ Errors:');
      metrics.errors.slice(-5).forEach(error => {
        console.log(`   - ${error}`);
      });
    }
    
    console.log('===================================\n');
  }
  
  startAutoReporting(intervalMs = 30000) {
    setInterval(() => {
      this.updateMemoryUsage();
      this.printReport();
    }, intervalMs);
  }
}

// Global monitor instance
let monitor: RedisMonitor | null = null;

export function getRedisMonitor(): RedisMonitor {
  if (!monitor) {
    monitor = new RedisMonitor();
  }
  return monitor;
}

// Auto-start monitoring in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_SCALABLE_SYNC_ENGINE === 'true') {
  console.log('🔍 Starting Redis Integration Monitor...');
  const monitor = getRedisMonitor();
  monitor.startAutoReporting(30000); // Report every 30 seconds
  
  // Also log on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      monitor.printReport();
    });
  }
}