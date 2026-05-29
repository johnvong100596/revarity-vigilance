"use client";

import { useState } from "react";
import { Sparkles, ExternalLink, Loader2 } from "lucide-react";

import type { Entitlement } from "@/lib/entitlements";

interface BillingSectionProps {
  entitlement: Entitlement;
  /** True once Stripe keys + the price are configured server-side. */
  billingConfigured: boolean;
}

/**
 * Settings card for the paid business-owner plan. Dormant (renders nothing)
 * until billing is configured, so nothing broken shows before Stripe is set up.
 * Plain-English copy only (Vu test): no "operator", "entitlement", "tier".
 */
export function BillingSection({
  entitlement,
  billingConfigured,
}: BillingSectionProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(path: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Something went wrong. Please try again.");
      setBusy(false);
    } catch {
      setError("Couldn't connect. Please try again.");
      setBusy(false);
    }
  }

  // A comped account: business features are on, but there's nothing to bill or
  // manage. Show a quiet confirmation rather than an upgrade pitch.
  const isComp = entitlement.tier === "operator" && entitlement.source === "comp";
  const isPaid =
    entitlement.tier === "operator" && entitlement.source === "subscription";

  // Free user and billing not wired up yet → render nothing.
  if (!isPaid && !isComp && !billingConfigured) return null;

  return (
    <section className="mb-10">
      <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        Plan
      </div>

      <div className="rounded-card border border-text-primary/8 bg-bg-tertiary p-4">
        {isPaid ? (
          <>
            <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
              <Sparkles className="h-4 w-4 text-accent-primary" />
              Business plan
            </div>
            <p className="mb-3 text-xs leading-relaxed text-text-muted">
              {entitlement.cancelAtPeriodEnd
                ? "Your business features stay on until the end of this billing period."
                : "Thanks for being on the business plan. You have the full set of business-owner tools."}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => go("/api/billing/portal")}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-text-primary/12 bg-bg-primary px-3 py-2.5 text-sm text-text-primary transition hover:border-accent-primary/40 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Manage billing
            </button>
          </>
        ) : isComp ? (
          <>
            <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
              <Sparkles className="h-4 w-4 text-accent-primary" />
              Business tools are on
            </div>
            <p className="text-xs leading-relaxed text-text-muted">
              The business-owner tools are switched on for your account.
            </p>
          </>
        ) : (
          <>
            <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
              <Sparkles className="h-4 w-4 text-accent-primary" />
              Run a business?
            </div>
            <p className="mb-3 text-xs leading-relaxed text-text-muted">
              Track who owes you, how long your cash will last, and money moved
              between your businesses — all in plain English.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => go("/api/billing/checkout")}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-accent-primary px-3 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              See the business plan
            </button>
          </>
        )}

        {error && (
          <p className="mt-3 text-[11px] text-negative" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
