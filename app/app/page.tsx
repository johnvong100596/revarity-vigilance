import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ChevronRight,
  Lightbulb,
  Menu,
  Plus,
  Repeat,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

import { AccountRow } from "@/components/AccountRow";
import { PlaidReconnectBanner } from "@/components/PlaidReconnectBanner";
import { ProjectionChart } from "@/components/ProjectionChart";
import { ReengageTakeover } from "@/components/ReengageTakeover";
import { StreakBadge } from "@/components/StreakBadge";
import { getUserDecaySummary } from "@/lib/decay";
import { getCachedLogosMap, type InstitutionLogo } from "@/lib/institution-logos";
import type { RawSnapshot } from "@/lib/rituals";
import { DEFAULT_TIMEZONE, localDateISO } from "@/lib/time";
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

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("home_currency, awareness_streak, decay_warnings_enabled, active_workspace_id, timezone")
    .eq("id", user.id)
    .single();
  const profile = (profileRow ?? null) as Pick<
    Profile,
    "home_currency" | "awareness_streak" | "decay_warnings_enabled" | "active_workspace_id" | "timezone"
  > | null;
  const workspaceId = profile?.active_workspace_id;
  if (!workspaceId) redirect("/login");
  const tz = profile?.timezone || DEFAULT_TIMEZONE;
  // "Today" in the user's timezone so day boundaries match check-in storage.
  const today = localDateISO(tz);

  // 90-day balance snapshots feed the projection chart's trend slope
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const thirtyFiveDaysAgo = new Date();
  thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35);

  const [accountsRes, hintsRes, brokenItemsRes, snapshotsRes, checkinsRes, checkinsTodayRes] =
    await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("archived", false)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("hints")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .order("severity_score", { ascending: false })
      .limit(5),
    supabase
      .from("plaid_items")
      .select("id, institution_name, status")
      .eq("workspace_id", workspaceId)
      .in("status", ["error", "disconnected"]),
    supabase
      .from("balance_snapshots")
      .select("account_id, balance, captured_at")
      .eq("workspace_id", workspaceId)
      .gte("captured_at", ninetyDaysAgo.toISOString())
      .order("captured_at", { ascending: true }),
    // Distinct-ish check-in dates over the last 35 days for the streak grid
    supabase
      .from("check_ins")
      .select("checkin_date")
      .eq("user_id", user.id)
      .gte("checkin_date", thirtyFiveDaysAgo.toISOString().slice(0, 10)),
    // The user's OWN check-ins for today — drives per-user "needs check-in"
    // so a teammate acknowledging an account never marks it done for you (M2).
    supabase
      .from("check_ins")
      .select("account_id")
      .eq("user_id", user.id)
      .eq("checkin_date", today),
  ]);

  const accounts: Account[] = accountsRes.data ?? [];
  const hints: Hint[] = hintsRes.data ?? [];
  const snapshots90d: RawSnapshot[] = (snapshotsRes.data ?? []) as RawSnapshot[];
  const checkinDates: string[] = Array.from(
    new Set(
      (checkinsRes.data ?? []).map((r) => r.checkin_date as string)
    )
  );

  // Bank icons: read cached logos only (never fetch from Plaid on render —
  // warming happens at connect/sync time). Missing logos fall back to the
  // generic letter icon and fill in after the next sync.
  const institutionIds = accounts
    .map((a) => a.institution_id)
    .filter((id): id is string => Boolean(id));
  let logoMap: Record<string, InstitutionLogo> = {};
  if (institutionIds.length > 0) {
    try {
      logoMap = await getCachedLogosMap(supabase, institutionIds);
    } catch {
      logoMap = {};
    }
  }
  const brokenBanks = (brokenItemsRes.data ?? []).map((b) => ({
    id: b.id as string,
    institutionName: (b.institution_name as string | null) ?? null,
    status: b.status as string,
  }));
  const homeCurrency: Currency = profile?.home_currency ?? "USD";
  const streak = profile?.awareness_streak ?? 0;
  const topHint = hints[0] ?? null;
  const activeHintCount = hints.length;

  // Net worth: assets minus debts. Multi-currency FX conversion lands Day 6.
  const netWorth = accounts.reduce((sum, a) => {
    const signed = toDecimal(a.balance).times(a.category === "asset" ? 1 : -1);
    return sum.plus(signed);
  }, toDecimal(0));

  // Week-over-week net worth change (Task 3.3). Baseline = latest snapshot
  // per account on/before 7 days ago; fall back to current balance for
  // accounts with no older snapshot. Only show when we actually have a
  // baseline AND the change is non-trivial (keeps the UI clean).
  const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekAgoBalById = new Map<string, number>();
  for (const s of snapshots90d) {
    if (new Date(s.captured_at).getTime() <= weekAgoMs) {
      weekAgoBalById.set(s.account_id, Number(s.balance)); // ascending → last wins
    }
  }
  let haveWeekBaseline = false;
  let weekAgoNet = 0;
  for (const a of accounts) {
    if (weekAgoBalById.has(a.id)) haveWeekBaseline = true;
    const bal = weekAgoBalById.get(a.id) ?? Number(a.balance);
    weekAgoNet += bal * (a.category === "asset" ? 1 : -1);
  }
  const weekChange = haveWeekBaseline
    ? netWorth.minus(toDecimal(weekAgoNet)).toNumber()
    : null;
  const showWeekChange = weekChange !== null && Math.abs(weekChange) >= 0.01;

  // Per-user "needs check-in" (M2): count the accounts THIS user hasn't
  // checked in today, from their own check-ins — not the shared
  // last_acknowledged_at, which a teammate's ack would flip for everyone.
  const checkedInTodayIds = new Set(
    (checkinsTodayRes.data ?? []).map((c) => c.account_id as string)
  );
  const accountsNeedingCheckin = accounts.filter(
    (a) => !checkedInTodayIds.has(a.id)
  ).length;

  const hasAccounts = accounts.length > 0;
  const hasMixedCurrency =
    hasAccounts && accounts.some((a) => a.currency !== homeCurrency);

  const TopHintIcon = topHint ? HINT_ICON[topHint.category] : null;

  // Decay system per THESIS.md §4 — 14+ days since the user touched ANY
  // account triggers the REENGAGE takeover. Replaces the normal home UI;
  // a single ack of any account resolves it on the next page load.
  // Settings: decay_warnings_enabled gates the takeover (per-row dots stay).
  const decay = getUserDecaySummary(accounts);
  const decayEnabled = profile?.decay_warnings_enabled ?? true;
  if (hasAccounts && decay.critical && decayEnabled) {
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

      {/* Reconnect banner — only renders when there are broken Plaid items */}
      <PlaidReconnectBanner banks={brokenBanks} />

      {/* Net worth */}
      <section className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          <span
            title="What you'd have if you sold everything and paid off everything"
            className="cursor-help underline decoration-text-muted/30 decoration-dotted underline-offset-2"
          >
            Net worth
          </span>
          <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent-primary">
            {homeCurrency}
          </span>
        </div>
        <div className="mt-2 text-[44px] font-bold leading-none tracking-[-0.03em] tabular-nums text-text-primary">
          {formatBalance(netWorth, homeCurrency)}
        </div>
        {showWeekChange && weekChange !== null && (
          <div
            className={`mt-2 text-sm font-medium tabular-nums ${
              weekChange >= 0 ? "text-positive" : "text-negative"
            }`}
          >
            {weekChange >= 0 ? "+" : "−"}
            {formatBalance(Math.abs(weekChange), homeCurrency)} this week
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 text-xs">
          <StreakBadge
            streak={streak}
            checkinDates={checkinDates}
            todayLocal={today}
          />
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
                {topHint.composed_body ?? topHint.body}
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
                  <AccountRow
                    account={a}
                    position={position}
                    logo={a.institution_id ? logoMap[a.institution_id] : null}
                  />
                </li>
              );
            })}
          </ul>

          <Link
            href="/app/accounts/add"
            className="mb-8 flex items-center justify-center gap-1.5 rounded-row border border-dashed border-text-primary/15 px-3 py-2.5 text-xs font-medium text-text-secondary transition hover:border-accent-primary/40 hover:text-accent-primary"
          >
            <Plus className="h-3.5 w-3.5" /> Connect another bank
          </Link>

          <ProjectionChart
            accounts={accounts}
            snapshots={snapshots90d}
            homeCurrency={homeCurrency}
          />

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

          <Link
            href="/app/ask"
            className="mt-3 flex items-center justify-between rounded-card border border-text-primary/8 bg-bg-tertiary p-4 transition hover:shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-medium text-text-primary">
                  Ask Vigilance
                </div>
                <div className="text-[11px] text-text-muted">
                  Reflect on your numbers in plain English
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-text-muted" />
          </Link>

          <Link
            href="/app/subscriptions"
            className="mt-2 flex items-center justify-between rounded-card border border-text-primary/8 bg-bg-tertiary p-4 transition hover:shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent-primary">
                <Repeat className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-medium text-text-primary">
                  Subscriptions
                </div>
                <div className="text-[11px] text-text-muted">
                  Recurring charges in one place — coming soon
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-text-muted" />
          </Link>
        </>
      ) : (
        // Onboarding empty state — the "first 30 seconds" guided flow
        <section className="mt-6">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-primary">
            Welcome to Vigilance
          </div>
          <h2 className="text-balance text-2xl font-bold leading-tight tracking-[-0.02em] text-text-primary">
            Let&apos;s set up your first 30 seconds.
          </h2>
          <p className="mt-3 max-w-[340px] text-[15px] leading-relaxed text-text-secondary">
            Two steps and the ritual begins. It starts with knowing what you
            have.
          </p>

          {/* Step 1 — connect a bank (active) */}
          <div className="mt-8 rounded-card border border-accent-primary/30 bg-bg-tertiary p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-primary text-xs font-bold text-white">
                1
              </span>
              <div>
                <div className="text-[15px] font-semibold text-text-primary">
                  Connect your first bank
                </div>
                <div className="text-xs text-text-secondary">
                  Read-only and secure. Takes about 20 seconds.
                </div>
              </div>
            </div>
            <Link
              href="/app/accounts/add"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent-primary px-6 py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Connect your bank
            </Link>
          </div>

          {/* Step 2 — first check-in (preview, unlocks after step 1) */}
          <div className="mt-3 rounded-card border border-text-primary/8 bg-bg-tertiary/50 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-text-primary/8 text-xs font-bold text-text-muted">
                2
              </span>
              <div>
                <div className="text-[15px] font-semibold text-text-muted">
                  Run your first check-in
                </div>
                <div className="text-xs text-text-muted">
                  Unlocks once a bank is connected.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
