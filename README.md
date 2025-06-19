# C3Chat - Multi-Model AI Chat Interface

A real-time chat application I built for the T3 Chat Cloneathon. It connects to multiple AI providers through a single interface.

**[Demo](https://clone3chat.vercel.app)**

## What It Does

I built C3Chat to solve a simple problem: I wanted to use different AI models (GPT-4, Gemini, Claude via OpenRouter) without switching between different apps. Each conversation gets a persistent URL so I can share specific chats or return to them later.

### Core Functionality
- Chat with OpenAI, Google Gemini, or any OpenRouter model
- Each conversation has its own URL (`/chat/{id}`)
- Messages appear instantly (Convex reactive queries)
- API keys stored encrypted in browser (never sent to my servers)
- Voice input, image uploads, web search integration

## Technical Architecture

### Why These Choices

**Convex for Backend**  
I chose Convex because it gives me real-time reactive queries out of the box. When a message updates, every connected client sees it instantly without polling or WebSockets configuration. The downside: vendor lock-in and limited control over database optimizations.

**Redis for Caching (Optional)**  
I added Upstash Redis for viewport-based message caching. It's completely optional - the app works fine without it. When enabled, it reduces Convex reads by ~80% for thread switching. The trade-off: added complexity and potential sync issues.

**Client-Side Encryption**  
API keys are encrypted using Web Crypto API before localStorage. I store a persistent key (not browser fingerprint) so encryption survives browser updates. The risk: if someone has physical access to your device, they could potentially extract the localStorage key.

### Architecture Decisions

**Message Loading Strategy**
- Load messages from Convex first (instant display)
- Sync to Redis in background (non-blocking)
- Viewport loading: only 50 messages in memory at once
- Problem I solved: Initially had 7+ Redis operations per message, optimized down to 2

**Streaming Responses**
- Create empty message with cursor immediately
- Stream chunks directly to UI
- Debounced Redis sync (300ms stable, 1000ms while streaming)
- Challenge: Preventing memory leaks from streaming buffers (now auto-cleaned)

**State Management**
- useReducer for complex state (messages, threads, viewport)
- Optimistic updates with rollback on failure
- Deduplication before state updates (prevents React key warnings)
- Issue I fixed: Messages were deduped after state update, causing warnings

## Real Performance Numbers

From my testing on localhost:
- Message display: <50ms from Convex
- Redis cache hit rate: 83% after warm-up
- Memory per thread: ~200KB (50 messages)
- Bundle size: 497KB gzipped (mostly AI SDK dependencies)

## Known Limitations

1. **No E2E Encryption**: Messages stored in plain text on Convex
2. **Redis Optional**: If Redis fails, falls back to Convex-only (slower thread switching)
3. **Attachment Size**: Limited to 20MB by Convex storage
4. **Search History**: Only cached for 1 hour to reduce storage
5. **No Offline Mode**: Requires internet connection for all operations

## What I Struggled With

**Redis Sync Timing**  
The hardest part was coordinating Redis syncs without blocking the UI. I went through 3 iterations:
1. Sync on every message update (terrible performance)
2. Sync only on completion (lost streaming updates)
3. Smart debouncing based on content changes (current solution)

**Message Deduplication**  
React was throwing key warnings because duplicate messages appeared during sync. Fixed by deduplicating at every entry point before state updates.

**Encryption Key Persistence**  
Originally used browser fingerprinting for encryption keys. Problem: browser updates changed the fingerprint, locking users out. Now I generate and store a random key.

## Setup

```bash
# Clone
git clone https://github.com/yourusername/c3chat.git
cd c3chat

# Install (using Bun for speed)
bun install

# Configure Convex
bunx convex dev

# Start dev server
bun run dev
```

### Optional Redis Setup
```bash
# Add to .env.local (optional for caching)
VITE_KV_REST_API_URL=your-upstash-url
VITE_KV_REST_API_TOKEN=your-upstash-token
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4
- **Backend**: Convex (database + functions)
- **Optional Cache**: Upstash Redis
- **AI SDKs**: OpenAI, Google Generative AI, custom SSE parser
- **Build**: Vite 6, Bun

## Security Considerations

- API keys encrypted client-side (AES-GCM)
- Never stored on my servers
- Each user's data isolated by auth
- No analytics or tracking
- Convex handles auth tokens

## Future Improvements

If I continue this project:
1. Add RAG for document chat
2. Implement proper message search
3. Add team workspaces
4. Better mobile UI
5. Export conversations to various formats

## License

MIT - Use this however you want.

---

Built for the T3 Chat Cloneathon by a solo developer who wanted a better way to use multiple AI models.