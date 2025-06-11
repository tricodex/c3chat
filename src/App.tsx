import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { ChatInterface } from "./components/ChatInterface";
import { ThreadList } from "./components/ThreadList";
import { EnhancedSyncProvider, useEnhancedSync, useSyncStatus } from "./lib/corrected-sync-engine";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Toaster />
      <Content />
    </div>
  );
}

function AuthenticatedContent() {
  const { state, actions } = useEnhancedSync();
  const syncStatus = useSyncStatus();

  // Show loading while initializing
  if (!syncStatus.isInitialized) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing local database...</p>
        </div>
      </div>
    );
  }

  // Show error if sync failed
  if (syncStatus.hasError) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Storage Error</h3>
          <p className="text-gray-600 mb-4">{syncStatus.error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn btn-primary"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-80 border-r bg-white h-full">
        <ThreadList />
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 h-full">
        {state.selectedThreadId ? (
          <ChatInterface />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-600 mb-2">
                Welcome to C3Chat
              </h2>
              <p className="text-gray-500 mb-6">
                Select a thread or create a new one to start chatting
              </p>
              
              {/* Quick action button */}
              <button
                onClick={() => actions.createThread()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                Start New Chat
              </button>
              
              {/* Storage status indicator */}
              <div className="mt-8 text-xs text-gray-400">
                <div className="flex items-center justify-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    state.isOnline ? 'bg-green-400' : 'bg-red-400'
                  }`}></div>
                  <span>
                    {state.isOnline ? 'Online' : 'Offline'} • 
                    {state.threads.length} threads • 
                    Last sync: {syncStatus.lastSyncTime ? new Date(syncStatus.lastSyncTime).toLocaleTimeString() : 'Never'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Unauthenticated>
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
          <h2 className="text-xl font-semibold text-primary">C3Chat</h2>
        </header>
        <main className="flex-1 flex">
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-md mx-auto">
              <div className="text-center mb-8">
                <h1 className="text-5xl font-bold text-primary mb-4">C3Chat</h1>
                <p className="text-xl text-secondary">AI-powered chat with real-time streaming</p>
              </div>
              <SignInForm />
            </div>
          </div>
        </main>
      </Unauthenticated>

      <Authenticated>
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
          <h2 className="text-xl font-semibold text-primary">C3Chat</h2>
          <SignOutButton />
        </header>
        <main className="flex-1 flex min-h-0">
        <EnhancedSyncProvider>
        <AuthenticatedContent />
        </EnhancedSyncProvider>
        </main>
      </Authenticated>
    </>
  );
}
