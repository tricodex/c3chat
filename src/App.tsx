import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { Toaster } from "sonner";
import { useState, useEffect } from "react";
import { EnhancedSyncProvider, useEnhancedSync } from "./lib/sync-engine-switcher";
import { Sidebar } from "./components/Sidebar";
import { IsolatedChatView } from "./components/IsolatedChatView";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { Header } from "./components/Header";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { CommandPalette } from "./components/CommandPalette";
import { SecurityInitializer } from "./components/SecurityInitializer";
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';

// Import Redis monitor in development
if (import.meta.env.DEV) {
  import('./lib/redis-monitor');
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sidebarOpen, setSidebarOpen] = useState(true); // Default to open on desktop

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
    <ErrorBoundary>
      <SecurityInitializer>
        <BrowserRouter>
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
        </BrowserRouter>
      </SecurityInitializer>
    </ErrorBoundary>
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
        <ErrorBoundary>
          <EnhancedSyncProvider>
            <CommandPalette theme={theme} setTheme={setTheme} />
            <Routes>
              <Route path="/" element={
                <AuthenticatedApp 
                  theme={theme} 
                  setTheme={setTheme}
                  sidebarOpen={sidebarOpen}
                  setSidebarOpen={setSidebarOpen}
                />
              } />
              <Route path="/chat/:chatId" element={
                <AuthenticatedApp 
                  theme={theme} 
                  setTheme={setTheme}
                  sidebarOpen={sidebarOpen}
                  setSidebarOpen={setSidebarOpen}
                />
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </EnhancedSyncProvider>
        </ErrorBoundary>
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
  // URL-based chat selection
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { actions, state } = useEnhancedSync();
  
  // Handle URL-based thread selection
  useEffect(() => {
    if (chatId && chatId !== state.selectedThreadId) {
      actions.selectThread(chatId);
    }
  }, [chatId, state.selectedThreadId, actions]);
  
  // Desktop sidebar is collapsed when sidebarOpen is false
  // Mobile sidebar is shown as overlay when sidebarOpen is true
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="c3-layout">
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar - On desktop, collapsed class is applied when !sidebarOpen */}
      <Sidebar 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        theme={theme}
        setTheme={setTheme}
        isCollapsed={!isMobile && !sidebarOpen}
        onThreadSelect={(threadId) => navigate(`/chat/${threadId}`)}
        onNewChat={async () => {
          const threadId = await actions.createThread();
          navigate(`/chat/${threadId}`);
        }}
      />
      
      {/* Main Content */}
      <div className="c3-main">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <IsolatedChatView />
      </div>
    </div>
  );
}