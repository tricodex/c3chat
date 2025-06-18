import { Redis } from '@upstash/redis';
import { RedisCache, CachedMessage } from '../lib/redis-cache';

async function smoothUITest() {
  console.log('🎬 Testing smooth UI updates with rapid messages...\n');
  
  const cache = new RedisCache();
  const threadId = 'smooth-test-' + Date.now();
  
  try {
    // 1. Create initial batch of messages
    console.log('📝 Creating initial message batch...');
    const initialMessages: CachedMessage[] = Array.from({ length: 20 }, (_, i) => ({
      _id: `msg-${i}`,
      threadId,
      content: `Initial message ${i + 1}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      timestamp: Date.now() - (20 - i) * 1000,
      version: 1,
    }));
    
    await cache.syncMessages(threadId, initialMessages);
    console.log('✅ Initial messages synced');
    
    // 2. Load viewport
    const viewport = await cache.getViewport(threadId);
    console.log(`📦 Viewport loaded with ${viewport.messages.length} messages`);
    
    // 3. Simulate rapid message additions (like during streaming)
    console.log('\n🚀 Simulating rapid message additions...');
    for (let i = 0; i < 10; i++) {
      const newMessage: CachedMessage = {
        _id: `rapid-${i}`,
        threadId,
        content: `Rapid message ${i + 1} - This simulates streaming content...`,
        role: 'assistant',
        timestamp: Date.now() + i * 100,
        version: 1,
      };
      
      // Add optimistic message
      await cache.addOptimisticMessage(newMessage);
      console.log(`  → Added message ${i + 1}/10`);
      
      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log('\n✅ Rapid message test completed');
    console.log('👁️  Check the browser for smooth scrolling behavior');
    
    // 4. Final viewport state
    const finalViewport = await cache.getViewport(threadId);
    console.log(`\n📊 Final state: ${finalViewport.messages.length} messages in viewport`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

smoothUITest();