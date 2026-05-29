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
  const callbackError = searchParams.get("error");
  const safeNext = next.startsWith("/") ? next : "/app";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "verifying" | "error"
  >("idle");
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

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("verifying");
    setErrorMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setStatus("sent");
      setErrorMsg(error.message);
      return;
    }
    window.location.assign(safeNext);
  }

  return (
    <div className="w-full max-w-[400px] space-y-8">
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
          We&apos;ll email you a 6-digit code and a sign-in link — use
          whichever&apos;s easier. No password to remember.
        </p>
      </header>

      {callbackError && status === "idle" && (
        <p className="rounded-lg bg-negative/10 px-4 py-3 text-center text-sm leading-relaxed text-negative">
          That sign-in link didn&apos;t work — it may have expired or already
          been opened. Enter your email below and we&apos;ll send a fresh one.
        </p>
      )}

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
          disabled={status === "sending" || status === "verifying" || !email}
          className="w-full"
        >
          {status === "sending"
            ? "Sending…"
            : status === "sent" || status === "verifying"
              ? "Resend"
              : "Email me a code"}
        </Button>
      </form>

      {(status === "sent" || status === "verifying") && (
        <form onSubmit={verifyCode} className="space-y-4">
          <p className="text-center text-sm leading-relaxed text-positive">
            Sent to {email}. Type the 6-digit code from the email, or just tap
            the link inside it. Can take 30 seconds — peek in spam too.
          </p>
          <div className="space-y-2">
            <Label
              htmlFor="code"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary"
            >
              6-digit code
            </Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={status === "verifying" || code.length < 6}
            className="w-full"
          >
            {status === "verifying" ? "Signing you in…" : "Sign in"}
          </Button>
        </form>
      )}

      <p className="text-center text-[11px] leading-relaxed text-text-muted">
        Code or link not arriving? They expire after 1 hour, check your spam
        folder, and email{" "}
        <a
          href="mailto:coo@revarity.com"
          className="text-text-secondary underline-offset-4 hover:underline"
        >
          coo@revarity.com
        </a>{" "}
        if it keeps failing.
      </p>

      {errorMsg && (
        <p className="text-center text-sm text-negative">{errorMsg}</p>
      )}

      <div className="flex justify-center gap-4 text-[11px] text-text-muted">
        <Link href="/privacy" className="hover:text-text-primary">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-text-primary">
          Terms
        </Link>
      </div>
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
