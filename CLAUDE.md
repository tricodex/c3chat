# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Runs both frontend (Vite) and backend (Convex) in parallel
- `npm run dev:frontend` - Frontend only with auto-open browser
- `npm run dev:backend` - Convex backend only
- `npx convex dev` - Direct Convex development mode

### Testing
- `npm run test` - Run tests in watch mode (Vitest)
- `npm run test:run` - Run tests once
- `npm run test:ui` - Open Vitest UI
- `npm run test:coverage` - Run tests with coverage report

### Validation
- `npm run lint` - Type check both frontend and backend code, validate Convex functions, and verify build

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
- Run `npm run test:coverage` before major changes
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
- Deployment: `npx convex deploy` for production

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

## CRITICAL: Enterprise Features
- **Copy Functionality**: All messages have copy-to-clipboard functionality (see `MessageActions` component)
- **Message Actions**: Hover over messages to see available actions
- **CSS Classes**: Use `c3-message-action` for action buttons, `c3-message-actions` for container
- **Future Features**: Message branching, editing, and regeneration are partially implemented in `EnterpriseMessageList`