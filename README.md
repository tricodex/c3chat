# C3Chat - AI Chat with Multi-Model Support

🏆 **T3 Chat Cloneathon Submission**

A modern, feature-rich AI chat application with support for 10+ LLM providers, real-time sync, and enterprise features.

**[🚀 Try Demo](https://c3chat.vercel.app)** | **[📺 Video Demo](#)** | **[📖 Documentation](docs/)**

## ✨ Features

### Core Features (Competition Requirements)
- ✅ **Multi-Model Chat**: 10+ LLM providers (OpenAI, Anthropic, Google, Meta, xAI, DeepSeek, etc.)
- ✅ **Authentication & Sync**: Real-time sync across devices with Convex
- ✅ **Browser Friendly**: Modern web app with React 19
- ✅ **Easy to Try**: [Live demo](https://c3chat.vercel.app) - no setup required!

### Bonus Features (All Implemented!)
- ✅ **Attachment Support**: Upload images & PDFs with AI analysis
- ✅ **Image Generation**: DALL-E 3, Gemini Flash, Imagen 3
- ✅ **Syntax Highlighting**: Beautiful code blocks with copy functionality
- ✅ **Resumable Streams**: Continue generation after refresh
- ✅ **Chat Branching**: Fork conversations at any point
- ✅ **Chat Sharing**: Public/private threads with collaboration
- ✅ **Web Search**: Integrated Brave, Tavily, Serper search
- ✅ **Bring Your Own Key**: Use your own API keys or try anonymously

### Extra Features
- 🎙️ **Voice Chat**: Speech-to-text and text-to-speech
- ⚡ **Redis Caching**: Sub-5ms cross-tab sync (optional)
- 📝 **Message Editing**: Edit and regenerate any message
- 🔍 **Command Palette**: Quick actions with `/` commands
- 🔐 **Security**: Encrypted key storage, secure auth
- 📊 **Token Tracking**: Monitor usage and costs

## 🚀 Quick Start

### Try Online
Visit [c3chat.vercel.app](https://c3chat.vercel.app) - no installation required!

### Run Locally
```bash
# Clone the repository
git clone https://github.com/yourusername/c3chat.git
cd c3chat

# Install dependencies
bun install

# Copy environment variables
cp .env.local.example .env.local

# Run development server
bun run dev
```

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite 6
- **Backend**: Convex (reactive database + serverless)
- **AI**: 10+ LLM providers with streaming support
- **Caching**: Upstash Redis (optional, for scale)
- **Testing**: Vitest, React Testing Library
- **Deployment**: Vercel + Convex

## 📸 Screenshots

### Multi-Model Chat
![Chat Interface](docs/screenshots/chat.png)

### Image Generation
![Image Generation](docs/screenshots/image-gen.png)

### Chat Branching
![Branching](docs/screenshots/branching.png)

## 🏗️ Architecture

```
c3chat/
├── src/              # React application
│   ├── components/   # UI components
│   ├── lib/          # Utilities & sync engine
│   └── pages/        # Route pages
├── convex/           # Backend functions
│   ├── threads.ts    # Thread management
│   ├── messages.ts   # Message operations
│   └── auth.ts       # Authentication
└── docs/             # Documentation
```

## 🔑 Environment Variables

```bash
# Required
VITE_CONVEX_URL=your-convex-url

# Optional (for Redis caching)
VITE_KV_REST_API_URL=your-upstash-url
VITE_KV_REST_API_TOKEN=your-upstash-token
VITE_ENABLE_REDIS_CACHE=false

# API keys configured in-app via Settings UI
```

## 📚 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Redis Integration](docs/REDIS_INTEGRATION_SUMMARY.md)
- [API Providers](docs/PROVIDERS.md)
- [Contributing](CONTRIBUTING.md)

## 🏆 Competition Submission

This project was built for the T3 Chat Cloneathon, implementing all core requirements and bonus features:

- **Unique Features**: Voice chat, Redis caching for scale, 10+ LLM providers
- **Code Quality**: TypeScript, comprehensive tests, clean architecture
- **User Experience**: Minimal design, fast performance, intuitive UI
- **Open Source**: MIT License, all code available

## 🙏 Acknowledgments

Built with [Convex](https://convex.dev), [Tailwind CSS](https://tailwindcss.com), and love for the T3 community.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.