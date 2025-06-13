import { 
  Bot, 
  Palette, 
  Search, 
  Wifi, 
  GitBranch, 
  Share2,
  Sparkles 
} from "lucide-react";

export function EmptyState() {
  return (
    <div className="c3-chat-container">
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-2xl px-6">
          {/* Logo/Icon */}
          <div className="mb-8 inline-flex items-center justify-center w-24 h-24 rounded-full shadow-xl c3-glow" style={{ backgroundImage: 'linear-gradient(to bottom right, var(--c3-primary), var(--c3-electric))' }}>
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          
          {/* Welcome Text */}
          <h1 className="text-4xl font-bold mb-4 c3-text-gradient">
            Welcome to C3Chat
          </h1>
          <p className="text-xl mb-8" style={{ color: 'var(--c3-text-secondary)' }}>
            Your advanced AI chat experience with multiple providers and cutting-edge features
          </p>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <FeatureCard
              icon={Bot}
              title="Multiple AI Models"
              description="Chat with GPT-5, Claude 4, Gemini 2.5, and more"
            />
            <FeatureCard
              icon={Palette}
              title="Image Generation"
              description="Create stunning visuals with /image command"
            />
            <FeatureCard
              icon={Search}
              title="Web Search"
              description="Get real-time information with /search"
            />
            <FeatureCard
              icon={Wifi}
              title="Offline Sync"
              description="Continue conversations even without internet"
            />
            <FeatureCard
              icon={GitBranch}
              title="Chat Branching"
              description="Explore multiple conversation paths"
            />
            <FeatureCard
              icon={Share2}
              title="Share Chats"
              description="Share your conversations with others"
            />
          </div>

          {/* CTA */}
          <p className="text-sm" style={{ color: 'var(--c3-text-tertiary)' }}>
            Select or create a chat from the sidebar to get started
          </p>
          
          {/* Keyboard Shortcuts */}
          <div className="mt-8 inline-flex gap-4 text-xs" style={{ color: 'var(--c3-text-muted)' }}>
            <kbd className="c3-kbd">⌘K</kbd>
            <span>Quick Search</span>
            <span style={{ color: 'var(--c3-border-primary)' }}>•</span>
            <kbd className="c3-kbd">⌘N</kbd>
            <span>New Chat</span>
            <span style={{ color: 'var(--c3-border-primary)' }}>•</span>
            <kbd className="c3-kbd">⌘/</kbd>
            <span>Commands</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { 
  icon: React.FC<{ className?: string }>; 
  title: string; 
  description: string; 
}) {
  return (
    <div className="c3-feature-card c3-hover-lift">
      <div className="w-12 h-12 mb-3 mx-auto rounded-lg flex items-center justify-center" style={{ backgroundColor: 'oklch(from var(--c3-primary) l c h / 0.1)' }}>
        <Icon className="w-6 h-6" style={{ color: 'var(--c3-primary)' }} />
      </div>
      <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--c3-text-primary)' }}>{title}</h3>
      <p className="text-xs" style={{ color: 'var(--c3-text-tertiary)' }}>{description}</p>
    </div>
  );
}
