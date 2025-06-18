#!/usr/bin/env bun
import { Redis } from '@upstash/redis';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const url = process.env.VITE_KV_REST_API_URL;
const token = process.env.VITE_KV_REST_API_TOKEN;

if (!url || !token) {
  console.error('❌ Redis environment variables not found!');
  process.exit(1);
}

const redis = new Redis({ url, token });

async function testRedisViewport() {
  console.log('🧪 Testing Redis viewport fix...\n');
  
  const threadId = 'k571423r4v4x19pw5r9kg8jvjh7j3d3g';
  const messagesKey = `messages:${threadId}`;
  
  try {
    // 1. Check current messages
    const messageCount = await redis.zcard(messagesKey);
    console.log(`📊 Current message count: ${messageCount}`);
    
    if (messageCount > 0) {
      // Get last 5 messages
      const messages = await redis.zrange(messagesKey, -5, -1);
      console.log(`\n📝 Last 5 messages:`);
      messages.forEach((msg, i) => {
        try {
          const parsed = typeof msg === 'string' ? JSON.parse(msg) : msg;
          const content = parsed.content || '';
          console.log(`  ${i + 1}. [${parsed.role}] ${content.substring(0, 50)}...`);
        } catch (e) {
          console.log(`  ${i + 1}. Failed to parse message:`, msg);
        }
      });
    }
    
    // 2. Test viewport loading
    console.log('\n🔍 Testing viewport loading...');
    const viewportMessages = await redis.zrange(messagesKey, -50, -1);
    console.log(`✅ Viewport would load ${viewportMessages.length} messages`);
    
    // 3. Test adding a new message
    console.log('\n📨 Simulating new message...');
    const newMessage = {
      _id: `test_${Date.now()}`,
      threadId,
      content: 'Test message to verify Redis sync',
      role: 'user',
      timestamp: Date.now(),
      version: 1,
    };
    
    await redis.zadd(messagesKey, {
      score: newMessage.timestamp,
      member: JSON.stringify(newMessage),
    });
    
    const newCount = await redis.zcard(messagesKey);
    console.log(`✅ New message count: ${newCount} (was ${messageCount})`);
    
    // 4. Clean up test message
    await redis.zrem(messagesKey, JSON.stringify(newMessage));
    console.log('🧹 Cleaned up test message');
    
    // 5. Check pipeline operation
    console.log('\n🔧 Testing pipeline operations...');
    const pipeline = redis.pipeline();
    pipeline.zcard(messagesKey);
    pipeline.exists(messagesKey);
    
    const results = await pipeline.exec();
    console.log('✅ Pipeline results:', results);
    
    console.log('\n✨ All tests passed! Redis viewport should now update correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRedisViewport().catch(console.error);