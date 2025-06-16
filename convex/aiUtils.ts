// Stream buffer for smoother UI updates
export class StreamBuffer {
  private buffer: string = "";
  private lastFlush: number = Date.now();
  private minInterval: number = 50; // Minimum ms between flushes
  private maxBuffer: number = 20; // Maximum characters to buffer

  add(text: string) {
    this.buffer += text;
  }

  shouldFlush(): boolean {
    const now = Date.now();
    const timeSinceFlush = now - this.lastFlush;
    
    return (
      this.buffer.length >= this.maxBuffer ||
      (this.buffer.length > 0 && timeSinceFlush >= this.minInterval)
    );
  }

  flush(): string {
    const content = this.buffer;
    this.buffer = "";
    this.lastFlush = Date.now();
    return content;
  }
}

// Sanitize content for safe display
export function sanitizeContent(content: string): string {
  // Remove any potential script tags or dangerous HTML
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?\s*(?:script|iframe|object|embed|link|style|base|meta)[^>]*>/gi, '')
    .trim();
}

// Retry with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on non-retryable errors
      if (error.status && error.status < 500 && error.status !== 429) {
        throw error;
      }
      
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}