import { RedisCache } from '../lib/redis-cache';

async function performanceCheck() {
  console.log('🔍 Checking performance and memory usage...\n');
  
  const cache = new RedisCache();
  
  try {
    // Get storage info
    const storageInfo = await cache.getStorageInfo();
    console.log('💾 Storage Info:', {
      memoryCacheSize: `${(storageInfo.memoryCacheSize / 1024).toFixed(2)} KB`,
      redisKeys: storageInfo.redisKeys,
      estimatedTotalSize: `${(storageInfo.estimatedSize / 1024).toFixed(2)} KB`,
    });
    
    // Test viewport loading performance
    console.log('\n⏱️  Testing viewport load performance...');
    const threadId = 'k577nztwk9ke0hkhzn40dweqv17hk9pc'; // Existing thread
    
    const startTime = performance.now();
    const viewport = await cache.getViewport(threadId);
    const loadTime = performance.now() - startTime;
    
    console.log(`✅ Viewport loaded in ${loadTime.toFixed(2)}ms`);
    console.log(`📦 Messages in viewport: ${viewport.messages.length}`);
    
    // Test memory cleanup
    console.log('\n🧹 Testing memory cleanup...');
    await cache.cleanup();
    console.log('✅ Memory cleanup completed');
    
    console.log('\n✨ Performance check completed successfully!');
    
  } catch (error) {
    console.error('❌ Performance check failed:', error);
  }
}

performanceCheck();