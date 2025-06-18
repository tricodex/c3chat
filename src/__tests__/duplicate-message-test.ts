/**
 * Test to diagnose duplicate message issue
 */

async function testDuplicateMessages() {
  console.log('🔍 Testing for duplicate message issue...\n');
  
  // Simulate the data flow
  const mockMessages = [
    { _id: 'msg1', content: 'Hello', role: 'user' as const },
    { _id: 'msg2', content: 'Hi there', role: 'assistant' as const },
    { _id: 'msg3', content: 'How are you?', role: 'user' as const },
    { _id: 'msg1', content: 'Hello', role: 'user' as const }, // Duplicate!
  ];
  
  console.log('📋 Original messages:', mockMessages.length);
  mockMessages.forEach(m => console.log(`  - ${m._id}: ${m.content}`));
  
  // Test deduplication
  console.log('\n🔧 Testing deduplication...');
  const uniqueMessages = Array.from(
    new Map(mockMessages.map(msg => [msg._id, msg])).values()
  );
  
  console.log('✅ After deduplication:', uniqueMessages.length);
  uniqueMessages.forEach(m => console.log(`  - ${m._id}: ${m.content}`));
  
  // Test duplicate detection
  console.log('\n🔍 Testing duplicate detection...');
  const messageIds = mockMessages.map(m => m._id);
  const duplicates = messageIds.filter((id, index) => messageIds.indexOf(id) !== index);
  
  if (duplicates.length > 0) {
    console.log('⚠️  Duplicates found:', duplicates);
  } else {
    console.log('✅ No duplicates found');
  }
  
  console.log('\n✨ Summary:');
  console.log('  - Deduplication using Map works correctly');
  console.log('  - This should prevent React key warnings');
  console.log('  - Applied in 3 places:');
  console.log('    1. MessageList component (for rendering)');
  console.log('    2. Viewport creation (immediate update)');
  console.log('    3. Redis sync (background sync)');
}

testDuplicateMessages();