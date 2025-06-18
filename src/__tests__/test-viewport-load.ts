import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.VITE_KV_REST_API_URL!,
  token: process.env.VITE_KV_REST_API_TOKEN!,
});

async function testViewportLoad() {
  console.log('🔍 Testing viewport load...\n');

  const threadId = 'k571423r4v4x19pw5r9kg8jvjh7j3d3g';
  
  // First add some test data
  console.log('📝 Adding test data...');
  await redis.del(`messages:${threadId}`);
  await redis.zadd(`messages:${threadId}`, {
    score: Date.now(),
    member: JSON.stringify({ _id: '1', content: 'Test message', role: 'user' })
  });
  const key = `messages:${threadId}`;
  
  try {
    // Check what's in Redis
    const count = await redis.zcard(key);
    console.log(`📊 Messages in Redis: ${count}`);
    
    // Try different ways to read the data
    console.log('\n🧪 Testing zrange...');
    const messages1 = await redis.zrange(key, 0, -1);
    console.log('zrange result:', messages1);
    
    console.log('\n🧪 Testing zrange with WITHSCORES...');
    const messages2 = await redis.zrange(key, 0, -1, { withScores: true });
    console.log('zrange with scores result:', messages2);
    
    console.log('\n🧪 Testing the last 50 messages (as in getViewport)...');
    const messages3 = await redis.zrange(key, -50, -1);
    console.log('Last 50 messages:', messages3);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testViewportLoad();