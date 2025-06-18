import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.VITE_KV_REST_API_URL!,
  token: process.env.VITE_KV_REST_API_TOKEN!,
});

async function simpleTest() {
  console.log('🔍 Simple Redis test...\n');
  
  try {
    // Test basic SET/GET
    console.log('1️⃣ Testing SET/GET...');
    await redis.set('test:key', 'test value');
    const value = await redis.get('test:key');
    console.log('GET result:', value);
    
    // Test ZADD with different formats
    console.log('\n2️⃣ Testing ZADD...');
    const key = 'test:sorted';
    await redis.del(key);
    
    // Try format 1: score, member as args
    try {
      const result1 = await redis.zadd(key, 100, 'member1');
      console.log('Format 1 (score, member):', result1);
    } catch (e) {
      console.log('Format 1 failed:', e.message);
    }
    
    // Try format 2: object with score/member
    try {
      const result2 = await redis.zadd(key, { score: 200, member: 'member2' });
      console.log('Format 2 ({score, member}):', result2);
    } catch (e) {
      console.log('Format 2 failed:', e.message);
    }
    
    // Try format 3: multiple in array
    try {
      const result3 = await redis.zadd(key, [
        { score: 300, member: 'member3' },
        { score: 400, member: 'member4' }
      ]);
      console.log('Format 3 (array):', result3);
    } catch (e) {
      console.log('Format 3 failed:', e.message);
    }
    
    // Check what's in the sorted set
    console.log('\n3️⃣ Reading back with ZRANGE...');
    const members = await redis.zrange(key, 0, -1);
    console.log('Members:', members);
    
    const count = await redis.zcard(key);
    console.log('Count:', count);
    
    // Clean up
    await redis.del('test:key');
    await redis.del(key);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

simpleTest();