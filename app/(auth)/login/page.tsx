"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/app";
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
    <div className="w-full max-w-[400px] space-y-10">
      <header className="space-y-3 text-center">
        <Link
          href="/"
          className="inline-block text-xl font-semibold tracking-tight text-text-primary"
        >
          Vigilance
        </Link>
        <h1 className="text-3xl font-bold tracking-[-0.025em] text-text-primary">
          Welcome
        </h1>
        <p className="text-sm text-text-secondary">
          We&apos;ll email you a magic link. No password needed.
        </p>
      </header>

      <form onSubmit={sendMagicLink} className="space-y-4">
        <div className="space-y-2">
          <Label
            htmlFor="email"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary"
          >
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
          size="lg"
          disabled={status === "sending" || !email}
          className="w-full"
        >
          {status === "sending" ? "Sending…" : "Send magic link"}
        </Button>
        {status === "sent" && (
          <p className="text-center text-sm text-positive">
            Check {email} for the link.
          </p>
        )}
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-text-primary/10" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-bg-primary px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            or
          </span>
        </div>
      </div>

      <Button
        type="button"
        onClick={signInWithGoogle}
        variant="outline"
        size="lg"
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
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-6 py-12">
      <Suspense fallback={<div className="text-sm text-text-secondary">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
