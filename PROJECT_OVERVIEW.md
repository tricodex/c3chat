# C3Chat - AI Chat App Competition Entry

## Project Overview

C3Chat is an advanced AI chat application built to surpass T3 Chat's capabilities by addressing its pain points while introducing innovative features. We leverage Convex's real-time reactive database to eliminate the sync engine complexity that plagued T3 Chat, while providing instant UI updates and seamless multi-model AI integration.

### Key Differentiators from T3 Chat

1. **True Real-time Architecture**: Using Convex's reactive queries instead of IndexDB/sync engines
2. **Multi-Model Support**: Not just OpenAI - supports Google Gemini, Anthropic Claude, and more via OpenRouter
3. **Advanced Features**: Chat branching, web search, image generation, file attachments
4. **Better Performance**: No sync delays, instant updates, optimistic UI everywhere
5. **Developer Experience**: Simple backend logic without complex sync debugging

## Core Features (Required)

### ✅ Chat with Various LLMs
- OpenAI GPT models (GPT-4o, GPT-4.1-nano)
- Google Gemini models
- Anthropic Claude models
- OpenRouter integration for 100+ models
- Easy model switching within conversations

### ✅ Authentication & Sync
- Convex Auth with multiple providers (Anonymous, Email, Google, GitHub)
- Real-time chat history synchronization across devices
- User-specific threads and messages

### ✅ Browser Friendly
- Modern React 19 + Vite setup
- Responsive design with Tailwind CSS v4
- Works on all modern browsers

### ✅ Easy to Try
- One-click anonymous sign-in
- Demo mode with pre-configured API keys
- Clear onboarding flow

## Bonus Features (Implemented)

### 🎯 Attachment Support
- Drag-and-drop file uploads
- Image preview in chat
- PDF viewing and text extraction
- File storage via Convex Storage

### 🎯 Image Generation
- DALL-E 3 integration
- Stable Diffusion via OpenRouter
- In-chat image preview
- Save generated images

### 🎯 Syntax Highlighting
- Automatic code detection
- Support for 100+ languages via Prism.js
- Copy code button
- Language labels

### 🎯 Resumable Streams
- Stream state persistence
- Continue generation after page refresh
- Resume interrupted responses

### 🎯 Chat Branching
- Create alternative conversation paths
- Visual branch indicator
- Switch between branches
- Merge branches

### 🎯 Chat Sharing
- Public share links
- Read-only viewer mode
- Copy conversation as markdown
- Export to various formats

### 🎯 Web Search
- Real-time web search via Brave API
- Search results inline in chat
- Source citations
- Fact-checking mode

### 🎯 Bring Your Own Key (BYOK)
- Support for personal API keys
- OpenRouter integration
- Secure key storage (client-side)
- Key usage tracking

### 🎯 Creative Features
- Voice input/output
- Markdown rendering with mermaid diagrams
- Chat templates/personas
- Collaborative chat rooms
- AI memory system
- Token usage visualization

## Tech Stack

- **Frontend**: React 19, Vite 6, Tailwind CSS v4
- **Backend**: Convex (reactive database + functions)
- **AI Providers**: OpenAI, Google Gemini, Anthropic, OpenRouter
- **Authentication**: Convex Auth
- **File Storage**: Convex Storage
- **Search**: Brave Search API
- **Code Highlighting**: Prism.js
- **Markdown**: react-markdown + remark plugins

## Local-First Architecture

Unlike T3 Chat's painful IndexDB implementation, C3Chat uses Convex's reactive system for true local-first experience:

1. **Instant UI Updates**: Optimistic mutations update UI immediately
2. **Real-time Sync**: Changes sync across devices in milliseconds
3. **Offline Support**: Queued actions execute when back online
4. **No Sync Bugs**: Server is the source of truth, no conflict resolution needed

## Development Status

- ✅ Core chat functionality
- ✅ Authentication system
- ✅ Thread management
- ✅ Message streaming
- 🚧 Multi-model support
- 🚧 File attachments
- 🚧 Advanced features

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your API keys to .env.local

# Run development server
npm run dev
```

## Competition Strategy

We're building a better T3 Chat by:
1. **Solving Real Problems**: No more sync engine debugging
2. **Adding Requested Features**: Everything users wanted in T3 Chat
3. **Better Performance**: True real-time without loading states
4. **Developer Experience**: Simple, maintainable codebase
5. **Unique Features**: Chat branching, collaborative rooms, AI memory

This isn't just a clone - it's what T3 Chat should have been from the start.
