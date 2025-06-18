#!/usr/bin/env bun
import { Redis } from '@upstash/redis';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const url = process.env.VITE_KV_REST_API_URL;
const token = process.env.VITE_KV_REST_API_TOKEN;

console.log('🔧 Testing Redis viewport functionality');

if (!url || !token) {
  console.error('❌ Redis environment variables not found!');
  process.exit(1);
}

const redis = new Redis({ url, token });

async function test() {
  const threadId = 'k571423r4v4x19pw5r9kg8jvjh7j3d3g';
  const messagesKey = `messages:${threadId}`;
  
  console.log('📊 Checking existing messages for thread:', threadId);
  
  // Check if messages exist
  const messageCount = await redis.zcard(messagesKey);
  console.log('📈 Message count in Redis:', messageCount);
  
  if (messageCount > 0) {
    // Get last 50 messages
    const messages = await redis.zrange(messagesKey, -50, -1);
    console.log('✅ Found messages:', messages.length);
    console.log('📝 First message:', messages[0]);
    console.log('📝 Last message:', messages[messages.length - 1]);
  } else {
    console.log('⚠️ No messages found in Redis for this thread');
    
    // Let's check what keys exist
    console.log('\n🔍 Checking all Redis keys...');
    const keys = await redis.keys('*');
    console.log('🔑 Total keys in Redis:', keys.length);
    console.log('🔑 Keys:', keys);
  }
}

test().catch(console.error);