"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./components/ui/Button";
import { Input } from "./components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/Card";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("password", password);
      formData.set("flow", flow);
      
      await signIn("password", formData);
      toast.success(`Successfully ${flow === "signIn" ? "signed in" : "signed up"}!`);
    } catch (error: any) {
      let toastTitle = "";
      if (error.message.includes("Invalid password")) {
        toastTitle = "Invalid password. Please try again.";
      } else {
        toastTitle =
          flow === "signIn"
            ? "Could not sign in, did you mean to sign up?"
            : "Could not sign up, did you mean to sign in?";
      }
      toast.error(toastTitle);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {flow === "signIn" ? "Welcome back" : "Create account"}
          </CardTitle>
          <p className="text-[var(--c3-text-secondary)] mt-2">
            {flow === "signIn" 
              ? "Enter your credentials to access your chats" 
              : "Sign up to start chatting with AI"}
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-[var(--c3-text-primary)]">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-[var(--c3-text-primary)]">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              loading={submitting}
              disabled={!email || !password}
            >
              {flow === "signIn" ? "Sign in" : "Sign up"}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-sm text-[var(--c3-text-tertiary)] hover:text-[var(--c3-text-primary)] transition-colors"
              onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
              disabled={submitting}
            >
              {flow === "signIn"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
      
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[var(--c3-border-subtle)]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[var(--c3-bg-primary)] px-2 text-[var(--c3-text-tertiary)]">Or continue with</span>
        </div>
      </div>
      
      <Button 
        variant="secondary" 
        className="w-full"
        onClick={() => void signIn("anonymous")}
        disabled={submitting}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Continue as Guest
      </Button>
    </div>
  );
}
