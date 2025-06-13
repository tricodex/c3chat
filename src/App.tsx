import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { Toaster } from "sonner";
import { useState, useEffect } from "react";
import { EnhancedSyncProvider } from "./lib/corrected-sync-engine";
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { Header } from "./components/Header";

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', theme);
    
    // Apply dark background color
    if (theme === 'dark') {
      document.body.style.backgroundColor = 'oklch(0.08 0.01 280)';
    } else {
      document.body.style.backgroundColor = 'oklch(0.98 0.005 280)';
    }
  }, [theme]);

  return (
    <div id="root">
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: theme === 'dark' ? 'var(--c3-surface-primary)' : 'white',
            color: 'var(--c3-text-primary)',
            border: '1px solid var(--c3-border-subtle)',
            borderRadius: 'var(--c3-radius-lg)',
          },
        }}
      />
      <Content theme={theme} setTheme={setTheme} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
    </div>
  );
}

function Content({ theme, setTheme, sidebarOpen, setSidebarOpen }: {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}) {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--c3-bg-primary)]">
        <div className="c3-spinner" />
      </div>
    );
  }

  return (
    <>
      <Unauthenticated>
        <WelcomeScreen />
      </Unauthenticated>

      <Authenticated>
        <EnhancedSyncProvider>
          <AuthenticatedApp 
            theme={theme} 
            setTheme={setTheme}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
          />
        </EnhancedSyncProvider>
      </Authenticated>
    </>
  );
}

function AuthenticatedApp({ theme, setTheme, sidebarOpen, setSidebarOpen }: {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}) {
  return (
    <div className="c3-layout">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        theme={theme}
        setTheme={setTheme}
      />
      
      {/* Main Content */}
      <div className="c3-main">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <ChatView />
      </div>
    </div>
  );
}
