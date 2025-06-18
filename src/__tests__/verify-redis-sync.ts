import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.VITE_KV_REST_API_URL!,
  token: process.env.VITE_KV_REST_API_TOKEN!,
});

async function verifyRedisSync() {
  console.log('🔍 Verifying Redis sync...\n');

  // Test thread ID
  const threadId = 'k571423r4v4x19pw5r9kg8jvjh7j3d3g';
  const key = `messages:${threadId}`;
  
  try {
    // Check if messages are in Redis
    const count = await redis.zcard(key);
    console.log(`✅ Messages in Redis for thread ${threadId}: ${count}`);
    
    if (count > 0) {
      // Get first few messages
      const messages = await redis.zrange(key, 0, 2);
      console.log('\n📋 Sample messages:');
      messages.forEach((msg, i) => {
        const parsed = JSON.parse(msg as string);
        console.log(`  ${i + 1}. ${parsed.role}: ${parsed.content.substring(0, 50)}...`);
      });
      
      // Test ZADD with new format
      console.log('\n🧪 Testing ZADD command with new format...');
      const testKey = 'test:zadd';
      const testArgs = [Date.now(), JSON.stringify({ test: 'message' })];
      await redis.zadd(testKey, ...testArgs);
      console.log('✅ ZADD test successful!');
      
      // Clean up test key
      await redis.del(testKey);
    } else {
      console.log('⚠️ No messages found in Redis. Messages may not be syncing properly.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyRedisSync();