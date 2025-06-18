import { Redis } from '@upstash/redis';
import { RedisCache } from '../lib/redis-cache';

const redis = new Redis({
  url: process.env.VITE_KV_REST_API_URL!,
  token: process.env.VITE_KV_REST_API_TOKEN!,
});

async function testManualSync() {
  console.log('🧪 Testing manual sync to Redis...\n');

  const threadId = 'k571423r4v4x19pw5r9kg8jvjh7j3d3g';
  const key = `messages:${threadId}`;
  
  try {
    // Clear any existing messages
    await redis.del(key);
    console.log('✅ Cleared existing messages');
    
    // Test messages
    const testMessages = [
      { _id: '1', threadId, content: 'Test message 1', role: 'user', timestamp: Date.now() - 3000, version: 1 },
      { _id: '2', threadId, content: 'Test response', role: 'assistant', timestamp: Date.now() - 2000, version: 1 },
      { _id: '3', threadId, content: 'Another message', role: 'user', timestamp: Date.now() - 1000, version: 1 },
    ];
    
    // Add messages using Upstash format - one at a time
    console.log('📝 Adding test messages...');
    for (const msg of testMessages) {
      // Upstash expects: zadd(key, {score: timestamp, member: data})
      await redis.zadd(key, {
        score: msg.timestamp,
        member: JSON.stringify(msg),
      });
    }
    console.log('✅ Messages added successfully!');
    
    // Verify
    const count = await redis.zcard(key);
    console.log(`\n📊 Messages in Redis: ${count}`);
    
    // Read back
    const messages = await redis.zrange(key, 0, -1);
    console.log('\n📋 Messages:');
    messages.forEach((msg, i) => {
      console.log(`  ${i + 1}. Raw: ${msg}`);
      try {
        const parsed = JSON.parse(msg as string);
        console.log(`      Parsed: ${parsed.role}: ${parsed.content}`);
      } catch (e) {
        console.log(`      Parse error: ${e}`);
      }
    });
    
    // Now test the RedisCache class
    console.log('\n🔧 Testing RedisCache class...');
    const cache = new RedisCache();
    
    // Test viewport loading
    const viewport = await cache.getViewport(threadId);
    console.log('\n📦 Viewport loaded:', {
      messageCount: viewport.messages.length,
      hasMoreTop: viewport.hasMore.top,
      hasMoreBottom: viewport.hasMore.bottom,
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testManualSync();