import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Listen for console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('Browser error:', msg.text());
    }
  });
  
  // Listen for page errors
  page.on('pageerror', (error) => {
    console.error('Page error:', error.message);
  });
  
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Wait for app to initialize
    
    // Check if app loaded successfully
    const appElement = await page.$('#root');
    if (appElement) {
      console.log('✅ App loaded successfully');
      
      // Check for React errors in the DOM
      const errorBoundary = await page.$('.error-boundary-message');
      if (errorBoundary) {
        const errorText = await errorBoundary.textContent();
        console.error('❌ Error boundary triggered:', errorText);
      }
    } else {
      console.error('❌ App failed to load - no root element found');
    }
    
  } catch (error) {
    console.error('❌ Failed to load app:', error);
  } finally {
    await browser.close();
  }
})();