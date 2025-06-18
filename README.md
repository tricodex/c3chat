# C3Chat - Minimal AI Chat with Multi-Model Support

A modern, minimal AI chat application built with React 19, Vite 6, and Convex. Features a monospace design aesthetic and support for multiple AI providers.

## Features

- **Multi-Model AI Support**: OpenAI, Google Gemini, Anthropic Claude, OpenRouter, Groq, Together AI, Fireworks AI, DeepSeek, Mistral, Cohere
- **Enterprise Chat Features**: 
  - Message editing and regeneration
  - Conversation branching
  - Copy functionality with visual feedback
  - Thread isolation for separate conversations
- **Real-time Sync**: Powered by Convex's reactive database
- **Voice Support**: OpenAI Whisper for speech-to-text and TTS for text-to-speech
- **Scalable Architecture**: 
  - Redis-based distributed caching
  - Cross-tab synchronization (<5ms)
  - Handles 1M+ messages per thread
  - Circuit breaker for network resilience
- **Modern Stack**: React 19, TypeScript, Tailwind CSS v4

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) (recommended) or Node.js
- A Convex account for the backend

### Installation
```bash
bun install
```

### Development
```bash
# Run both frontend and backend
bun run dev

# Frontend only
bun run dev:frontend

# Backend only
bun run dev:backend
```

### Building
```bash
# Build for production
bun run build

# Preview production build
bun run preview
```

### Testing
```bash
# Run tests in watch mode
bun run test

# Run tests once
bun run test:run

# Run with coverage
bun run test:coverage
```

## Deployment

### Vercel
The app is configured for easy deployment to Vercel:

1. Install Vercel CLI: `bun add -g vercel`
2. Deploy: `vercel`

The project includes:
- `vercel.json` with proper Vite + Bun configuration
- Platform-specific dependencies for Linux builds
- Automatic bun detection via `bun.lock`

### Convex Backend
Deploy the Convex backend:
```bash
bunx convex deploy
```

## Project Structure

```
c3chat/
├── src/              # Frontend React application
├── convex/           # Backend functions and schema
├── dist/             # Production build output
└── public/           # Static assets
```

## Environment Variables

### Required Variables

```bash
# Convex
VITE_CONVEX_URL=your-convex-url

# Redis Cache (Upstash)
VITE_KV_REST_API_URL=your-upstash-url
VITE_KV_REST_API_TOKEN=your-upstash-token
VITE_ENABLE_REDIS_CACHE=false # Set to true to enable Redis

# AI Providers (stored encrypted in Convex)
# Configure via Settings UI in the app
```

- Frontend: Use `VITE_*` prefix (exposed to browser)
- Backend: Standard variables in Convex functions
- Copy `.env.local.example` to `.env.local` and fill in values

## Tech Stack

- **Frontend**: React 19 + Vite 6 + TypeScript
- **Backend**: Convex (reactive database + serverless)
- **Caching**: Upstash Redis (distributed cache layer)
- **Styling**: Tailwind CSS v4 (PostCSS-based)
- **Testing**: Vitest + React Testing Library
- **Package Manager**: Bun

## License

This project was built with [Chef](https://chef.convex.dev) and is connected to Convex deployment [`beaming-nightingale-998`](https://dashboard.convex.dev/d/beaming-nightingale-998).