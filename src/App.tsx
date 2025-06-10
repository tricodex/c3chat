import { Authenticated, Unauthenticated, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { useState } from "react";
import { Id } from "../convex/_generated/dataModel";
import { ChatInterface } from "./components/ChatInterface";
import { ThreadList } from "./components/ThreadList";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
        <h2 className="text-xl font-semibold text-primary">C3Chat</h2>
        <SignOutButton />
      </header>
      <main className="flex-1 flex">
        <Content />
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const [selectedThreadId, setSelectedThreadId] = useState<Id<"threads"> | null>(null);

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
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-5xl font-bold text-primary mb-4">C3Chat</h1>
              <p className="text-xl text-secondary">AI-powered chat with real-time streaming</p>
            </div>
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>

      <Authenticated>
        <div className="flex w-full h-full">
          {/* Sidebar */}
          <div className="w-80 border-r bg-white">
            <ThreadList 
              selectedThreadId={selectedThreadId}
              onSelectThread={setSelectedThreadId}
            />
          </div>
          
          {/* Main Chat Area */}
          <div className="flex-1">
            {selectedThreadId ? (
              <ChatInterface threadId={selectedThreadId} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold text-gray-600 mb-2">
                    Welcome to C3Chat
                  </h2>
                  <p className="text-gray-500">
                    Select a thread or create a new one to start chatting
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Authenticated>
    </>
  );
}
