"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("sent");
  }

  async function signInWithGoogle() {
    setErrorMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) setErrorMsg(error.message);
  }

  return (
    <div className="w-full max-w-sm space-y-10">
      <header className="space-y-3 text-center">
        <div className="text-[10px] tracking-[0.25em] text-accent-primary">
          VIGILANCE
        </div>
        <h1 className="font-ledger text-3xl text-text-primary">
          Daily check-in
        </h1>
        <p className="text-sm text-text-secondary">
          Your money in front of you, every day.
        </p>
      </header>

      <form onSubmit={sendMagicLink} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-text-secondary">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@revarity.com"
          />
        </div>
        <Button
          type="submit"
          disabled={status === "sending" || !email}
          className="w-full"
        >
          {status === "sending" ? "Sending…" : "Send magic link"}
        </Button>
        {status === "sent" && (
          <p className="text-center text-sm text-text-secondary">
            Check {email} for the link.
          </p>
        )}
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em]">
          <span className="bg-bg-primary px-3 text-text-muted">or</span>
        </div>
      </div>

      <Button
        type="button"
        onClick={signInWithGoogle}
        variant="outline"
        className="w-full"
      >
        Continue with Google
      </Button>

      {errorMsg && (
        <p className="text-center text-sm text-negative">{errorMsg}</p>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <Suspense fallback={<div className="text-sm text-text-secondary">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
