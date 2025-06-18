#!/usr/bin/env bun
import { Redis } from '@upstash/redis';

// Load environment variables
const url = process.env.VITE_KV_REST_API_URL || import.meta.env?.VITE_KV_REST_API_URL;
const token = process.env.VITE_KV_REST_API_TOKEN || import.meta.env?.VITE_KV_REST_API_TOKEN;

console.log('🔧 Environment check:', {
  url: url ? '✅ Found' : '❌ Missing',
  token: token ? '✅ Found' : '❌ Missing',
  urlValue: url,
});

if (!url || !token) {
  console.error('❌ Redis environment variables not found!');
  console.log('Make sure VITE_KV_REST_API_URL and VITE_KV_REST_API_TOKEN are set');
  process.exit(1);
}

try {
  const redis = new Redis({ url, token });
  
  console.log('📡 Testing Redis connection...');
  
  // Test ping
  const pong = await redis.ping();
  console.log('✅ Ping successful:', pong);
  
  // Test setting a value
  const testKey = 'test:connection';
  const testValue = { test: true, timestamp: Date.now() };
  await redis.set(testKey, testValue);
  console.log('✅ Set test value');
  
  // Test getting the value
  const retrieved = await redis.get(testKey);
  console.log('✅ Retrieved test value:', retrieved);
  
  // Test zadd (used for messages)
  const messagesKey = 'messages:test_thread';
  await redis.zadd(messagesKey, {
    score: Date.now(),
    member: JSON.stringify({ _id: 'test1', content: 'Test message' })
  });
  console.log('✅ Added test message to sorted set');
  
  // Test zrange
  const messages = await redis.zrange(messagesKey, 0, -1);
  console.log('✅ Retrieved messages:', messages);
  
  // Cleanup
  await redis.del(testKey);
  await redis.del(messagesKey);
  console.log('✅ Cleanup complete');
  
  console.log('\n🎉 Redis connection is working perfectly!');
} catch (error) {
  console.error('❌ Redis connection error:', error);
}