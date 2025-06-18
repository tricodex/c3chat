# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `bun run dev` - Runs both frontend (Vite) and backend (Convex) in parallel
- `bun run dev:frontend` - Frontend only with auto-open browser
- `bun run dev:backend` - Convex backend only
- `bunx convex dev` - Direct Convex development mode

### Testing
- `bun run test` - Run tests in watch mode (Vitest)
- `bun run test:run` - Run tests once
- `bun run test:ui` - Open Vitest UI
- `bun run test:coverage` - Run tests with coverage report

### Building & Deployment
- `bun run build` - Build for production (using Vite)
- `bun run preview` - Preview production build locally
- `vercel` - Deploy to Vercel (requires Vercel CLI)

### Validation
- `bun run lint` - Type check both frontend and backend code, validate Convex functions, and verify build

## Architecture

### Tech Stack
- **Frontend**: React 19 + Vite 6 + TypeScript
- **Backend**: Convex (reactive database + serverless functions)
- **Styling**: Tailwind CSS v4 (PostCSS-based)
- **Testing**: Vitest + React Testing Library
- **Package Manager**: Bun recommended (npm/yarn also work)

### Key Architectural Decisions

1. **Convex-First Architecture**: 
   - Server is the single source of truth
   - No IndexedDB or complex sync engines needed
   - Optimistic UI with automatic rollback on failures
   - Real-time updates via reactive queries

2. **Multi-Model AI Support**:
   - Providers: OpenAI, Google Gemini, Anthropic Claude, OpenRouter, Groq, Together AI, Fireworks AI, DeepSeek, Mistral, Cohere
   - Configurable per chat/project
   - Voice input/output via OpenAI Whisper and TTS

3. **File Structure**:
   - `/src` - Frontend React application
   - `/convex` - Backend functions and schema
   - `/convex/_generated` - Auto-generated types (do not edit)
   - `@/*` path alias maps to `./src/*`

## Development Guidelines

### Environment Variables
- Frontend vars: `VITE_*` prefix (exposed to browser)
- Backend vars: No prefix, accessed via `process.env` in Convex functions
- Convex deployment URL: Set automatically by Convex CLI

### Adding New Features
1. Define schema in `convex/schema.ts` if database changes needed
2. Create Convex functions in `convex/` directory
3. Use generated hooks from `convex/_generated/react` in frontend
4. Add tests in `__tests__` directories near the code

### Testing Strategy
- Unit tests for utilities and hooks
- Component tests with React Testing Library
- Run `bun run test:coverage` before major changes
- Tests should be colocated with the code they test

### Authentication
- Uses Convex Auth with multiple providers (Google, GitHub, Email)
- Auth state managed via `useConvexAuth()` hook
- Protected routes check authentication status

### Common Patterns
- Use `useQuery` for reactive data fetching
- Use `useMutation` for data modifications
- Optimistic updates are automatic with Convex
- Error handling via try/catch in async functions
- Loading states via Convex's built-in status

## Important Notes
- Convex functions run in a V8 isolate (not Node.js)
- Database queries are reactive and real-time by default
- File uploads use Convex storage with automatic URL generation
- Vector search powered by Convex's built-in vector indexes
- Deployment: `bunx convex deploy` for production

## Deployment to Vercel
- **Platform**: Vercel supports Vite and Bun out of the box
- **Build Command**: `bun run build` (configured in vercel.json)
- **Install Command**: `bun install` (auto-detected from bun.lock)
- **Output Directory**: `dist` (Vite default)
- **Platform Dependencies**: Linux x64 GNU binaries added to optionalDependencies:
  - `@rollup/rollup-linux-x64-gnu`
  - `@tailwindcss/oxide-linux-x64-gnu`
  - `lightningcss-linux-x64-gnu`
- **Deploy Command**: `vercel` (after local build)

## CRITICAL: Package Dependencies
- **Google AI**: ALWAYS use `@google/genai` version ^1.5.1 (NOT `@google/generative-ai` which is deprecated)
  - Correct import: `import { GoogleGenAI } from "@google/genai";`
  - Initialize: `new GoogleGenAI({ apiKey: 'YOUR_KEY' });`
  - Use: `await genAI.models.generateContentStream({ model: 'gemini-2.0-flash', contents: ... });`
  - The new SDK is the unified SDK for all Google GenAI models (Gemini, Veo, Imagen, etc.)
- **Package Manager**: Use `bun` (NOT npm) for all operations

## CRITICAL: Thread Isolation
- **Message Isolation**: Messages MUST be strictly isolated by thread ID to prevent cross-contamination
- **Thread Switching**: Always clear ALL messages when switching threads (see `SELECT_THREAD` in sync engine)
- **Component Usage**: Use `IsolatedChatView` instead of `ChatView` directly for proper thread isolation
- **Message Filtering**: Always double-check that messages belong to the current thread before rendering
- **Convex Queries**: Ensure message queries are properly scoped to the selected thread ID

## CRITICAL: Enterprise Features (Fully Implemented)
- **Copy Functionality**: All messages have copy-to-clipboard functionality with visual feedback
- **Message Editing**: User messages can be edited in-place with auto-resize textarea
- **Response Regeneration**: Assistant messages can be regenerated, creating new responses while preserving history
- **Conversation Branching**: Fork conversations at any message to explore alternative paths
- **Message Actions**: Hover over messages to see context-sensitive actions:
  - Copy (all messages)
  - Branch (all messages)
  - Edit (user messages only)
  - Regenerate (assistant messages only)
- **CSS Classes**: 
  - `c3-message-action` for action buttons
  - `c3-message-actions` for container
  - `c3-message-edit` for edit mode
  - `c3-edit-textarea` for edit input
- **Implementation**: See `MessageActions.tsx`, `MessageEdit.tsx`, and `MessageList.tsx`