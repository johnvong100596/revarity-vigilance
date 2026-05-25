import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";

import { daysSinceTouched } from "@/lib/decay";
import type { Account } from "@/lib/types";

interface ReengageTakeoverProps {
  daysAway: number;
  criticalAccounts: Account[];
}

/**
 * Shown in place of the /app home when the user has been away ≥ 14 days
 * (or all accounts have decayed past critical). Per THESIS.md §4 — the
 * "killer visual mechanic". A single CTA back into the ritual; the
 * takeover dismisses naturally on the next acknowledge because the
 * triggering condition (minDays ≥ 14) flips when any account is touched.
 */
export function ReengageTakeover({
  daysAway,
  criticalAccounts,
}: ReengageTakeoverProps) {
  const sample = criticalAccounts.slice(0, 5);
  return (
    <main className="flex min-h-[88vh] flex-col">
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-primary">
          <Flame className="h-3 w-3" />
          Re-engage
        </div>
        <h1 className="text-balance text-[40px] font-bold leading-[1.05] tracking-[-0.03em] text-text-primary md:text-[56px]">
          You haven&apos;t checked in
        </h1>
        <div className="mt-3 font-bold leading-none tabular-nums text-accent-primary text-[72px] tracking-[-0.04em] md:text-[96px]">
          {daysAway}
        </div>
        <div className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">
          {daysAway === 1 ? "day" : "days"}
        </div>
        <p className="mx-auto mt-8 max-w-[340px] text-base leading-relaxed text-text-secondary">
          Let&apos;s go account by account. The drift never stops; the ritual
          is the only thing that does.
        </p>

        <Link
          href="/app/checkin"
          className="group mt-10 inline-flex items-center gap-2 rounded-full bg-accent-primary px-8 py-4 text-base font-semibold text-white transition hover:opacity-90"
        >
          Check in now
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
      </section>

      {sample.length > 0 && (
        <section className="mt-10 border-t border-text-primary/8 pt-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Accounts you&apos;ve been ignoring
          </div>
          <ul className="mt-4 space-y-2">
            {sample.map((a) => {
              const days = daysSinceTouched(a);
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-card border border-text-primary/8 bg-bg-tertiary px-4 py-2.5 opacity-70 grayscale"
                >
                  <div>
                    <div className="text-sm font-medium text-text-primary">
                      {a.name}
                    </div>
                    {a.subtitle && (
                      <div className="text-[11px] text-text-secondary">
                        {a.subtitle}
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] font-semibold tabular-nums uppercase tracking-[0.14em] text-decay-warning">
                    {days}d
                  </div>
                </li>
              );
            })}
            {criticalAccounts.length > sample.length && (
              <li className="px-4 pt-1 text-[11px] text-text-muted">
                + {criticalAccounts.length - sample.length} more
              </li>
            )}
          </ul>
        </section>
      )}
    </main>
  );
}
