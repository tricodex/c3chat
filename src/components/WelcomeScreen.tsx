import { SignInForm } from "../SignInForm";
import { Bot, Zap, Globe, Palette } from "lucide-react";

export function WelcomeScreen() {
  return (
    <div className="min-h-screen bg-[var(--c3-bg-primary)] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <h1 className="text-5xl font-normal mb-6 text-[var(--c3-text-primary)] tracking-wide" 
              style={{ 
                fontFamily: 'var(--c3-font-mono)', 
                fontWeight: '400',
                letterSpacing: '0.1em'
              }}>
            C3CHAT
          </h1>
          
          <p className="text-[var(--c3-text-secondary)] text-lg">
            Experience the future of AI conversations
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <FeatureCard
            icon={Bot}
            title="Multiple AI Models"
            description="Chat with GPT-4, Claude, Gemini & more"
          />
          <FeatureCard
            icon={Zap}
            title="Real-time Streaming"
            description="Lightning-fast responses as they generate"
          />
          <FeatureCard
            icon={Globe}
            title="Web Search"
            description="Access real-time information from the web"
          />
          <FeatureCard
            icon={Palette}
            title="Image Generation"
            description="Create stunning visuals with AI"
          />
        </div>

        {/* Sign In Form */}
        <div className="bg-[var(--c3-surface-primary)] border border-[var(--c3-border-subtle)] rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-[var(--c3-text-primary)] mb-6 text-center">
            Get Started
          </h2>
          <SignInForm />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[var(--c3-text-muted)]">
          Built with Convex, React, and Tailwind CSS v4
        </p>
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
    <div className="bg-[var(--c3-surface-primary)] border border-[var(--c3-border-subtle)] rounded-xl p-4 text-center c3-transition-all hover:border-[var(--c3-primary)] hover:shadow-lg group">
      <div className="w-10 h-10 mb-2 mx-auto bg-[var(--c3-primary)]/10 rounded-lg flex items-center justify-center">
        <Icon className="w-5 h-5 text-[var(--c3-primary)]" />
      </div>
      <h3 className="font-semibold text-[var(--c3-text-primary)] text-sm mb-1 group-hover:text-[var(--c3-primary)]">
        {title}
      </h3>
      <p className="text-[var(--c3-text-tertiary)] text-xs">
        {description}
      </p>
    </div>
  );
}
