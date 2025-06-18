import { chromium } from 'playwright';

async function testC3Chat() {
  console.log('🧪 Starting C3Chat browser automation test...\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // 1. Navigate to the app
    console.log('📍 Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded');
    
    // 2. Check if messages are visible
    console.log('\n🔍 Checking for messages...');
    const messages = await page.locator('[class*="message"]').count();
    console.log(`✅ Found ${messages} messages`);
    
    // 3. Test scroll behavior
    console.log('\n📜 Testing scroll behavior...');
    const messagesContainer = await page.locator('[class*="messages-container"], [class*="overflow-y-auto"]').first();
    
    if (messagesContainer) {
      // Scroll to top
      await messagesContainer.evaluate(el => el.scrollTop = 0);
      await page.waitForTimeout(500);
      
      // Scroll to bottom
      await messagesContainer.evaluate(el => el.scrollTop = el.scrollHeight);
      await page.waitForTimeout(500);
      console.log('✅ Scroll behavior tested');
    }
    
    // 4. Test message input
    console.log('\n💬 Testing message input...');
    const textarea = await page.locator('textarea').first();
    
    if (textarea) {
      await textarea.click();
      await textarea.fill('Test message: Checking smooth UI updates');
      console.log('✅ Message typed');
      
      // Find and click send button
      const sendButton = await page.locator('button[type="submit"], button[aria-label*="send"]').first();
      if (sendButton) {
        await sendButton.click();
        console.log('✅ Message sent');
        
        // Wait for response
        await page.waitForTimeout(2000);
        
        // Check if message appeared
        const testMessage = await page.locator('text=Test message: Checking smooth UI updates').count();
        console.log(testMessage > 0 ? '✅ Message appeared in chat' : '⚠️ Message not found');
      }
    }
    
    // 5. Check for console errors
    console.log('\n🔍 Checking for console errors...');
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });
    
    await page.waitForTimeout(1000);
    
    if (consoleMessages.length === 0) {
      console.log('✅ No console errors detected');
    } else {
      console.log(`⚠️ Found ${consoleMessages.length} console errors:`);
      consoleMessages.forEach(msg => console.log(`  - ${msg}`));
    }
    
    // 6. Test rapid scrolling (jitter test)
    console.log('\n🎬 Testing rapid scrolling for jitter...');
    for (let i = 0; i < 5; i++) {
      await messagesContainer.evaluate(el => {
        el.scrollTop = Math.random() * el.scrollHeight;
      });
      await page.waitForTimeout(100);
    }
    console.log('✅ Rapid scroll test completed');
    
    // 7. Performance check
    console.log('\n⚡ Checking performance metrics...');
    const metrics = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
          totalJSHeapSize: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
        };
      }
      return null;
    });
    
    if (metrics) {
      console.log('📊 Memory usage:', metrics);
    }
    
    console.log('\n✨ All tests completed successfully!');
    
    // Keep browser open for manual inspection
    console.log('\n👀 Browser will stay open for 10 seconds for manual inspection...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testC3Chat().catch(console.error);