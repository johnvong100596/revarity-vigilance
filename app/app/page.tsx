import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ChevronRight,
  Flame,
  Lightbulb,
  Menu,
  Plus,
  Sparkles,
} from "lucide-react";

import { AccountRow } from "@/components/AccountRow";
import { createClient } from "@/lib/supabase/server";
import {
  formatBalance,
  toDecimal,
  type Currency,
} from "@/lib/money";
import type { Account, Hint, Profile } from "@/lib/types";

const HINT_COLOR_BORDER: Record<Hint["category"], string> = {
  pay_attention: "border-hint-pay-attention/40",
  opportunity: "border-accent-primary/30",
  strategic: "border-hint-strategic/40",
};

const HINT_COLOR_LABEL: Record<Hint["category"], string> = {
  pay_attention: "text-hint-pay-attention",
  opportunity: "text-accent-primary",
  strategic: "text-hint-strategic",
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

  // Net worth: assets minus debts. Multi-currency FX conversion lands Day 6
  // with the fx-refresh cron + balance_snapshots; until then we sum natively.
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

  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <Link
          href="/app/settings"
          aria-label="Settings"
          className="text-text-secondary transition hover:text-text-primary"
        >
          <Menu className="h-5 w-5" />
        </Link>
        <Link
          href="/app/hints"
          aria-label="Hints"
          className="relative text-accent-primary transition hover:opacity-80"
        >
          <Lightbulb className="h-5 w-5" />
          {activeHintCount > 0 && (
            <span className="absolute -right-1.5 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-negative px-1 text-[9px] font-medium text-white">
              {activeHintCount}
            </span>
          )}
        </Link>
      </header>

      <section className="mb-6">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[10px] tracking-[0.2em] text-text-secondary">
            NET WORTH
          </span>
          <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent-primary">
            {homeCurrency}
          </span>
        </div>
        <div className="font-ledger text-[40px] leading-none text-text-primary">
          {formatBalance(netWorth, homeCurrency)}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-text-secondary">
          {streak > 0 ? (
            <span className="inline-flex items-center gap-1 text-positive">
              {streak} <Flame className="h-3 w-3" />
            </span>
          ) : (
            <span className="text-text-muted">Day 1 of vigilance</span>
          )}
          {hasMixedCurrency && (
            <span className="text-text-muted">· FX rates pending</span>
          )}
        </div>
      </section>

      {hasAccounts ? (
        <>
          <Link
            href="/app/checkin"
            className="mb-4 flex items-center justify-between rounded-hero border border-accent-primary/40 bg-bg-secondary p-3.5 transition hover:bg-bg-tertiary"
          >
            <div>
              <div className="text-sm font-medium text-text-primary">
                Daily check-in
              </div>
              <div className="text-[11px] text-text-secondary">
                {accountsNeedingCheckin === 0
                  ? "All accounts acknowledged today"
                  : `${accountsNeedingCheckin} account${
                      accountsNeedingCheckin === 1 ? "" : "s"
                    } to acknowledge`}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-accent-primary" />
          </Link>

          {topHint && (
            <Link
              href="/app/hints"
              className={`mb-5 block rounded-card border ${HINT_COLOR_BORDER[topHint.category]} bg-accent-soft p-3 transition hover:bg-accent-primary/15`}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles
                    className={`h-3 w-3 ${HINT_COLOR_LABEL[topHint.category]}`}
                  />
                  <span
                    className={`text-[10px] tracking-[0.15em] ${HINT_COLOR_LABEL[topHint.category]}`}
                  >
                    EXPERT HINT
                  </span>
                </div>
                <ChevronRight
                  className={`h-3.5 w-3.5 ${HINT_COLOR_LABEL[topHint.category]}`}
                />
              </div>
              <div className="text-xs leading-relaxed text-text-primary">
                {topHint.body}
              </div>
            </Link>
          )}

          <ul className="mb-5">
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
            className="mb-6 flex items-center justify-center gap-1.5 rounded-row border border-dashed border-white/10 px-3 py-2 text-xs text-text-secondary transition hover:border-accent-primary/40 hover:text-accent-primary"
          >
            <Plus className="h-3.5 w-3.5" /> Add account
          </Link>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/app/reckoning"
              className="rounded-row bg-bg-secondary p-3 text-center transition hover:bg-bg-tertiary"
            >
              <div className="text-[10px] tracking-[0.15em] text-accent-primary">
                SUNDAY
              </div>
              <div className="mt-1 text-xs text-text-secondary">Reckoning</div>
            </Link>
            <Link
              href="/app/close"
              className="rounded-row bg-bg-secondary p-3 text-center transition hover:bg-bg-tertiary"
            >
              <div className="text-[10px] tracking-[0.15em] text-accent-primary">
                MONTHLY
              </div>
              <div className="mt-1 text-xs text-text-secondary">Close</div>
            </Link>
          </div>
        </>
      ) : (
        <section className="mt-10 flex flex-col items-center text-center">
          <div className="mb-3 text-[10px] tracking-[0.25em] text-text-muted">
            NO ACCOUNTS YET
          </div>
          <p className="mb-8 max-w-[290px] text-sm leading-relaxed text-text-secondary">
            Add your bank, credit cards, crypto, and investments. The ritual
            starts with knowing what you have.
          </p>
          <Link
            href="/app/accounts/add"
            className="inline-flex items-center gap-2 rounded-hero border border-accent-primary bg-accent-soft px-5 py-3 text-sm font-medium text-accent-primary transition hover:bg-accent-primary hover:text-bg-primary"
          >
            <Plus className="h-4 w-4" /> Add your first account
          </Link>
        </section>
      )}
    </>
  );
}
