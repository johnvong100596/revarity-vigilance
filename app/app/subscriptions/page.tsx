import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Subscriptions (Task 6.3). Recurring-charge detection isn't live yet — it
 * needs the recurring-transactions feed turned on with our bank-data partner
 * (tracked in BLOCKERS-NIGHT-2026-05-26.md). Until then we show a clearly-
 * labeled PREVIEW of how the screen will look, with sample charges, so the
 * value is obvious. The sample is honestly marked — we never imply these are
 * the user's real charges.
 */

interface SampleSub {
  name: string;
  amount: string;
  cadence: string;
  tint: string;
}

const SAMPLE_SUBS: SampleSub[] = [
  { name: "Netflix", amount: "$15.49", cadence: "every month", tint: "#E50914" },
  { name: "Spotify", amount: "$10.99", cadence: "every month", tint: "#1DB954" },
  { name: "iCloud+", amount: "$2.99", cadence: "every month", tint: "#3B82F6" },
  { name: "Gym", amount: "$45.00", cadence: "every month", tint: "#F04E37" },
];

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

      <p className="mb-2 text-sm leading-relaxed text-text-secondary">
        Every recurring charge in one place — so nothing renews or quietly
        raises its price without you noticing.
      </p>

      {/* Honest preview label — these are sample charges, not real data yet */}
      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-primary">
        Preview · sample charges
      </div>

      <div className="mb-3 text-sm font-medium text-text-primary">
        We found these recurring charges. Tap any to learn more.
      </div>

      <ul className="overflow-hidden rounded-card border border-text-primary/8">
        {SAMPLE_SUBS.map((s, i) => (
          <li
            key={s.name}
            className={`flex items-center justify-between bg-bg-tertiary px-4 py-3.5 ${
              i > 0 ? "border-t border-text-primary/6" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-sm font-bold text-white"
                style={{ backgroundColor: s.tint }}
                aria-hidden
              >
                {s.name[0]}
              </span>
              <div>
                <div className="text-sm font-medium text-text-primary">
                  {s.name}
                </div>
                <div className="text-xs text-text-secondary">{s.cadence}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[15px] font-semibold tabular-nums text-text-primary">
                {s.amount}
              </div>
              <span className="text-[11px] text-text-muted">Stop tracking</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-card border border-text-primary/8 bg-bg-tertiary px-4 py-3 text-center">
        <p className="text-[12px] leading-relaxed text-text-secondary">
          Recurring charge detection is coming soon. Once it&apos;s on, your
          real charges show up here automatically — no setup.
        </p>
      </div>
    </>
  );
}
