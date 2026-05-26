import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Repeat, AlertCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Subscription detection scaffold (Task 3.4).
 *
 * The UI ships now; the data layer is on hold until Plaid grants the
 * Recurring Transactions product (tracked in BLOCKERS-NIGHT-2026-05-26.md).
 *
 * Once Plaid grants the product:
 *   1. Add "recurring_transactions" to LINK_PRODUCTS in lib/plaid.ts
 *   2. Re-link existing banks (or wait for next re-link prompt) to pick up
 *      the new product scope
 *   3. Add a poll cron + a "subscriptions" table to persist Plaid's
 *      detected recurring streams (merchant, amount, cadence, last_seen,
 *      next_expected)
 *   4. Replace the empty-state below with the subscription list grouped
 *      by status: active, paused, recently changed, expected this week
 *   5. Wire a "review" action per row (cancel hint, keep, snooze N days)
 */
export default async function SubscriptionsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <header className="mb-6 flex items-center gap-2">
        <Link
          href="/app"
          aria-label="Back"
          className="-m-2 p-2 text-text-secondary transition hover:text-text-primary"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold text-text-primary">
          Subscriptions
        </h1>
      </header>

      <section className="mt-12 flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-primary">
          <Repeat className="h-6 w-6" />
        </div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Coming soon
        </div>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">
          Recurring charges, in one place
        </h2>
        <p className="mb-8 max-w-[300px] text-[14px] leading-relaxed text-text-secondary">
          Every subscription, every renewal date, every silent price
          increase — Vigilance will surface them so nothing renews without
          you noticing.
        </p>

        <div className="mb-6 max-w-[320px] rounded-card border border-text-primary/8 bg-bg-tertiary px-4 py-3 text-left">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-primary">
            <AlertCircle className="h-3 w-3" />
            What we&apos;re waiting on
          </div>
          <p className="text-[12px] leading-relaxed text-text-secondary">
            Plaid&apos;s recurring transactions feed needs an extra access
            grant. Once that lands, every connected bank will start showing
            its subscriptions here automatically.
          </p>
        </div>

        <Link
          href="/app"
          className="text-xs font-medium text-accent-primary transition hover:underline"
        >
          Back to home
        </Link>
      </section>
    </>
  );
}
