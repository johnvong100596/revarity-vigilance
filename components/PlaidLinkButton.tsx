"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { Banknote, Loader2 } from "lucide-react";

type Phase = "fetching-token" | "ready" | "linking" | "exchanging" | "error";

export function PlaidLinkButton() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("fetching-token");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch a Link token on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/plaid/link-token", { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `link-token failed: ${res.status}`);
        }
        const { link_token } = await res.json();
        if (cancelled) return;
        setLinkToken(link_token);
        setPhase("ready");
      } catch (e) {
        if (cancelled) return;
        setErrorMsg(e instanceof Error ? e.message : "Failed to start Plaid");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSuccess = useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      setPhase("exchanging");
      try {
        const res = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token: publicToken, metadata }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `exchange failed: ${res.status}`);
        }
        // Auto-route home — the new accounts should be visible immediately
        router.push("/app");
        router.refresh();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Exchange failed");
        setPhase("error");
      }
    },
    [router]
  );

  const onExit = useCallback((err: unknown) => {
    // User dismissed or hit error in Plaid Link
    if (err) {
      const msg =
        err && typeof err === "object" && "display_message" in err
          ? String((err as { display_message?: string }).display_message)
          : "Link cancelled";
      setErrorMsg(msg);
      setPhase("error");
      return;
    }
    setPhase("ready");
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit,
  });

  function handleClick() {
    if (!ready || !linkToken) return;
    setErrorMsg(null);
    setPhase("linking");
    open();
  }

  const disabled =
    phase === "fetching-token" || phase === "exchanging" || !ready;

  const label = (() => {
    switch (phase) {
      case "fetching-token":
        return "Preparing…";
      case "ready":
        return "Connect with Plaid";
      case "linking":
        return "Linking…";
      case "exchanging":
        return "Importing accounts…";
      case "error":
        return "Try again";
    }
  })();

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-accent-primary py-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {phase === "fetching-token" || phase === "exchanging" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Banknote className="h-4 w-4" />
        )}
        {label}
      </button>
      <p className="mt-2 text-center text-[11px] leading-relaxed text-text-muted">
        Read-only. Credentials never touch our servers. Sandbox bank: First
        Platypus, user_good / pass_good.
      </p>
      {errorMsg && (
        <p className="mt-3 text-center text-xs text-negative">{errorMsg}</p>
      )}
    </div>
  );
}
