/**
 * Test to verify app initialization order
 */

import React from 'react';
import { createRoot } from 'react-dom/client';

// Test 1: Check if window is available
console.log('Test 1 - Window available:', typeof window !== 'undefined');

// Test 2: Check if React hooks work in a simple component
function TestComponent() {
  const [count, setCount] = React.useState(0);
  console.log('Test 2 - Hook works, count:', count);
  return <div>Test: {count}</div>;
}

// Test 3: Try to render a simple component
const testDiv = document.createElement('div');
document.body.appendChild(testDiv);
const root = createRoot(testDiv);
root.render(<TestComponent />);

console.log('Test 3 - Component rendered successfully');

// Test 4: Check wallet config import
try {
  const config = await import('../lib/wallet-config-lazy');
  console.log('Test 4 - Wallet config imported:', !!config.getWagmiConfig);
} catch (error) {
  console.error('Test 4 - Wallet config import failed:', error);
}

export {};