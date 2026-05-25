import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ChevronRight,
  Lightbulb,
  Menu,
  Plus,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

import { AccountRow } from "@/components/AccountRow";
import { ReengageTakeover } from "@/components/ReengageTakeover";
import { getUserDecaySummary } from "@/lib/decay";
import { createClient } from "@/lib/supabase/server";
import {
  formatBalance,
  toDecimal,
  type Currency,
} from "@/lib/money";
import type { Account, Hint, Profile } from "@/lib/types";

const HINT_ACCENT: Record<Hint["category"], string> = {
  pay_attention: "border-l-hint-pay-attention",
  opportunity: "border-l-hint-opportunity",
  strategic: "border-l-hint-strategic",
};

const HINT_LABEL_COLOR: Record<Hint["category"], string> = {
  pay_attention: "text-hint-pay-attention",
  opportunity: "text-accent-primary",
  strategic: "text-hint-strategic",
};

const HINT_ICON: Record<Hint["category"], React.ComponentType<{ className?: string }>> = {
  pay_attention: AlertTriangle,
  opportunity: Sparkles,
  strategic: Sparkles,
};

const HINT_LABEL_TEXT: Record<Hint["category"], string> = {
  pay_attention: "Pay attention",
  opportunity: "Opportunity",
  strategic: "Strategic",
};

export default async function HomePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [accountsRes, profileRes, hintsRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("archived", false)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("home_currency, awareness_streak")
      .eq("id", user.id)
      .single(),
    supabase
      .from("hints")
      .select("*")
      .eq("status", "active")
      .order("severity_score", { ascending: false })
      .limit(5),
  ]);

  const accounts: Account[] = accountsRes.data ?? [];
  const profile = (profileRes.data ?? null) as Pick<
    Profile,
    "home_currency" | "awareness_streak"
  > | null;
  const hints: Hint[] = hintsRes.data ?? [];
  const homeCurrency: Currency = profile?.home_currency ?? "USD";
  const streak = profile?.awareness_streak ?? 0;
  const topHint = hints[0] ?? null;
  const activeHintCount = hints.length;

  // Net worth: assets minus debts. Multi-currency FX conversion lands Day 6.
  const netWorth = accounts.reduce((sum, a) => {
    const signed = toDecimal(a.balance).times(a.category === "asset" ? 1 : -1);
    return sum.plus(signed);
  }, toDecimal(0));

  const today = new Date().toISOString().slice(0, 10);
  const accountsNeedingCheckin = accounts.filter(
    (a) => !a.last_acknowledged_at || !a.last_acknowledged_at.startsWith(today)
  ).length;

  const hasAccounts = accounts.length > 0;
  const hasMixedCurrency =
    hasAccounts && accounts.some((a) => a.currency !== homeCurrency);

  const TopHintIcon = topHint ? HINT_ICON[topHint.category] : null;

  // Decay system per THESIS.md §4 — 14+ days since the user touched ANY
  // account triggers the REENGAGE takeover. Replaces the normal home UI;
  // a single ack of any account resolves it on the next page load.
  const decay = getUserDecaySummary(accounts);
  if (hasAccounts && decay.critical) {
    return (
      <ReengageTakeover
        daysAway={decay.daysSinceAnyTouch}
        criticalAccounts={decay.criticalAccounts}
      />
    );
  }

  return (
    <>
      {/* Top bar */}
      <header className="mb-8 flex items-center justify-between">
        <Link
          href="/app/settings"
          aria-label="Settings"
          className="-m-2 p-2 text-text-secondary transition hover:text-text-primary"
        >
          <Menu className="h-5 w-5" />
        </Link>
        <Link
          href="/app/hints"
          aria-label="Hints"
          className="relative -m-2 p-2 text-text-primary transition hover:text-accent-primary"
        >
          <Lightbulb className="h-5 w-5" />
          {activeHintCount > 0 && (
            <span className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-primary px-1 text-[10px] font-semibold text-white">
              {activeHintCount}
            </span>
          )}
        </Link>
      </header>

      {/* Net worth */}
      <section className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          Net worth
          <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent-primary">
            {homeCurrency}
          </span>
        </div>
        <div className="mt-2 text-[44px] font-bold leading-none tracking-[-0.03em] tabular-nums text-text-primary">
          {formatBalance(netWorth, homeCurrency)}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs">
          {streak > 0 ? (
            <span className="font-medium text-positive">
              {streak} day streak
            </span>
          ) : (
            <span className="text-text-muted">Day 1 of vigilance</span>
          )}
          {hasMixedCurrency && (
            <>
              <span className="text-text-muted">·</span>
              <span className="text-text-muted">FX rates pending</span>
            </>
          )}
        </div>
      </section>

      {hasAccounts ? (
        <>
          {/* Daily check-in CTA */}
          <Link
            href="/app/checkin"
            className="mb-4 flex items-center justify-between rounded-hero border border-text-primary/8 bg-bg-tertiary p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
          >
            <div>
              <div className="text-[15px] font-semibold text-text-primary">
                Daily check-in
              </div>
              <div className="mt-0.5 text-xs text-text-secondary">
                {accountsNeedingCheckin === 0
                  ? "All accounts acknowledged today"
                  : `${accountsNeedingCheckin} account${
                      accountsNeedingCheckin === 1 ? "" : "s"
                    } to acknowledge`}
              </div>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-primary text-white">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          {/* Top hint preview */}
          {topHint && TopHintIcon && (
            <Link
              href="/app/hints"
              className={`mb-6 block rounded-card border border-text-primary/8 border-l-[3px] ${HINT_ACCENT[topHint.category]} bg-bg-tertiary p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)]`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <TopHintIcon
                    className={`h-3.5 w-3.5 ${HINT_LABEL_COLOR[topHint.category]}`}
                  />
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${HINT_LABEL_COLOR[topHint.category]}`}
                  >
                    {HINT_LABEL_TEXT[topHint.category]}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-text-muted" />
              </div>
              <div className="text-sm leading-relaxed text-text-primary">
                {topHint.body}
              </div>
            </Link>
          )}

          {/* Accounts list */}
          <ul className="mb-5 overflow-hidden rounded-card border border-text-primary/8 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            {accounts.map((a, i) => {
              const position =
                accounts.length === 1
                  ? "only"
                  : i === 0
                    ? "first"
                    : i === accounts.length - 1
                      ? "last"
                      : "middle";
              return (
                <li key={a.id}>
                  <AccountRow account={a} position={position} />
                </li>
              );
            })}
          </ul>

          <Link
            href="/app/accounts/add"
            className="mb-8 flex items-center justify-center gap-1.5 rounded-row border border-dashed border-text-primary/15 px-3 py-2.5 text-xs font-medium text-text-secondary transition hover:border-accent-primary/40 hover:text-accent-primary"
          >
            <Plus className="h-3.5 w-3.5" /> Add account
          </Link>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/app/reckoning"
              className="rounded-card border border-text-primary/8 bg-bg-tertiary p-4 text-center transition hover:shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-primary">
                Sunday
              </div>
              <div className="mt-1.5 text-sm font-medium text-text-primary">
                Reckoning
              </div>
            </Link>
            <Link
              href="/app/close"
              className="rounded-card border border-text-primary/8 bg-bg-tertiary p-4 text-center transition hover:shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-primary">
                Monthly
              </div>
              <div className="mt-1.5 text-sm font-medium text-text-primary">
                Close
              </div>
            </Link>
          </div>
        </>
      ) : (
        // Empty state
        <section className="mt-12 flex flex-col items-center text-center">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            No accounts yet
          </div>
          <p className="mb-10 max-w-[300px] text-[15px] leading-relaxed text-text-secondary">
            Add your bank, credit cards, crypto, and investments. The ritual
            starts with knowing what you have.
          </p>
          <Link
            href="/app/accounts/add"
            className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-6 py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add your first account
          </Link>
        </section>
      )}
    </>
  );
}
