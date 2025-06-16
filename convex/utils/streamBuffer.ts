/**
 * StreamBuffer for smooth UI updates during AI streaming
 * Batches updates to prevent excessive re-renders
 */
export class StreamBuffer {
  private buffer: string = "";
  private lastFlush: number = Date.now();
  private flushInterval: number = 50; // milliseconds
  private minChunkSize: number = 5; // minimum characters before flushing
  
  constructor(flushInterval: number = 50, minChunkSize: number = 5) {
    this.flushInterval = flushInterval;
    this.minChunkSize = minChunkSize;
  }
  
  add(chunk: string): void {
    this.buffer += chunk;
  }
  
  shouldFlush(): boolean {
    const timeSinceLastFlush = Date.now() - this.lastFlush;
    const hasEnoughContent = this.buffer.length >= this.minChunkSize;
    const timeThresholdMet = timeSinceLastFlush >= this.flushInterval;
    
    return hasEnoughContent && timeThresholdMet;
  }
  
  flush(): string {
    const content = this.buffer;
    this.buffer = "";
    this.lastFlush = Date.now();
    return content;
  }
  
  forceFlush(): string {
    return this.flush();
  }
  
  hasContent(): boolean {
    return this.buffer.length > 0;
  }
  
  getBufferSize(): number {
    return this.buffer.length;
  }
}

/**
 * Token counter for cost estimation
 */
export class TokenCounter {
  private model: string;
  private encoder: any = null;
  
  constructor(model: string) {
    this.model = model;
    // In a real implementation, you'd load a tokenizer here
    // For now, we'll use a simple estimation
  }
  
  // Simple token estimation (4 chars ≈ 1 token for English)
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
  
  estimateCost(inputTokens: number, outputTokens: number): number {
    // Cost per 1M tokens (approximate)
    const costs: Record<string, { input: number; output: number }> = {
      "gpt-4o": { input: 5, output: 15 },
      "gpt-4o-mini": { input: 0.15, output: 0.6 },
      "claude-3-opus": { input: 15, output: 75 },
      "claude-3-sonnet": { input: 3, output: 15 },
      "claude-3-haiku": { input: 0.25, output: 1.25 },
      "gemini-1.5-pro": { input: 3.5, output: 10.5 },
      "gemini-1.5-flash": { input: 0.35, output: 1.05 },
    };
    
    const modelCost = costs[this.model] || { input: 1, output: 2 };
    
    const inputCost = (inputTokens / 1_000_000) * modelCost.input;
    const outputCost = (outputTokens / 1_000_000) * modelCost.output;
    
    return inputCost + outputCost;
  }
}

/**
 * Retry logic for failed API calls
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on non-retryable errors
      if (!isRetryableError(error)) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

export function isRetryableError(error: any): boolean {
  // Retry on network errors or 5xx status codes
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    return true;
  }
  
  if (error.status >= 500 && error.status < 600) {
    return true;
  }
  
  // Retry on rate limit errors with backoff
  if (error.status === 429) {
    return true;
  }
  
  return false;
}