import { RedisCache } from '../lib/redis-cache';
import { CachedMessage } from '../lib/types';

async function integrationTest() {
  console.log('🚀 Running integration test...\n');
  
  const cache = new RedisCache();
  const threadId = 'test-thread-' + Date.now();
  
  try {
    // 1. Create test messages
    console.log('1️⃣ Creating test messages...');
    const messages: CachedMessage[] = Array.from({ length: 10 }, (_, i) => ({
      _id: `msg-${i}`,
      threadId,
      content: `Test message ${i + 1}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      timestamp: Date.now() - (10 - i) * 1000,
      version: 1,
    }));
    
    // 2. Sync messages to Redis
    console.log('2️⃣ Syncing messages to Redis...');
    await cache.syncMessages(threadId, messages);
    console.log('✅ Sync completed');
    
    // 3. Load viewport
    console.log('\n3️⃣ Loading viewport...');
    const viewport = await cache.getViewport(threadId);
    console.log('📦 Viewport loaded:', {
      messageCount: viewport.messages.length,
      firstMessage: viewport.messages[0]?.content,
      lastMessage: viewport.messages[viewport.messages.length - 1]?.content,
      hasMoreTop: viewport.hasMore.top,
      hasMoreBottom: viewport.hasMore.bottom,
    });
    
    // 4. Test optimistic updates
    console.log('\n4️⃣ Testing optimistic message...');
    const optimisticMsg: CachedMessage = {
      _id: 'optimistic-1',
      threadId,
      content: 'This is an optimistic message',
      role: 'user',
      timestamp: Date.now(),
      version: 1,
      isOptimistic: true,
    };
    await cache.addOptimisticMessage(optimisticMsg);
    console.log('✅ Optimistic message added');
    
    // 5. Test streaming update
    console.log('\n5️⃣ Testing streaming message update...');
    const streamingId = 'streaming-1';
    await cache.updateStreamingMessage(streamingId, 'Hello', threadId);
    await cache.updateStreamingMessage(streamingId, 'Hello, world!', threadId);
    await cache.updateStreamingMessage(streamingId, 'Hello, world! How are you?', threadId, true);
    console.log('✅ Streaming updates completed');
    
    // 6. Verify final state
    console.log('\n6️⃣ Final viewport state:');
    const finalViewport = await cache.getViewport(threadId);
    console.log('📊 Total messages:', finalViewport.messages.length);
    console.log('✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

integrationTest();