import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ChevronRight,
  CreditCard,
  Lightbulb,
  Menu,
  Plus,
  Repeat,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

import { AccountRow } from "@/components/AccountRow";
import { EntityFilter } from "@/components/EntityFilter";
import { GettingStartedCard } from "@/components/GettingStartedCard";
import { LocaleDetector } from "@/components/LocaleDetector";
import { PayThisWeek } from "@/components/PayThisWeek";
import { PlaidReconnectBanner } from "@/components/PlaidReconnectBanner";
import { ProjectionChart } from "@/components/ProjectionChart";
import { ReengageTakeover } from "@/components/ReengageTakeover";
import { StreakBadge } from "@/components/StreakBadge";
import { WelcomeMoment } from "@/components/WelcomeMoment";
import { buildUpcomingPayments } from "@/lib/payments";
import { getUserDecaySummary } from "@/lib/decay";
import { getCachedLogosMap, type InstitutionLogo } from "@/lib/institution-logos";
import type { RawSnapshot } from "@/lib/rituals";
import { DEFAULT_TIMEZONE, addDaysISO, localDateISO } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import {
  formatBalance,
  toDecimal,
  type Currency,
} from "@/lib/money";
import type { Account, Entity, Hint, Profile } from "@/lib/types";

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

interface HomePageProps {
  searchParams: { entity?: string };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const supabase = createClient();
  const entityFilter = searchParams?.entity ?? null; // null | "<uuid>" | "untagged"

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("home_currency, awareness_streak, decay_warnings_enabled, active_workspace_id, timezone, welcomed, locale_detected, is_operator, created_at")
    .eq("id", user.id)
    .single();
  const profile = (profileRow ?? null) as Pick<
    Profile,
    "home_currency" | "awareness_streak" | "decay_warnings_enabled" | "active_workspace_id" | "timezone" | "welcomed" | "locale_detected" | "is_operator" | "created_at"
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

  const [accountsRes, hintsRes, brokenItemsRes, snapshotsRes, checkinsRes, checkinsTodayRes, paymentMarksRes] =
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
    // Payment marks for the pay-this-week widget — only matter for due dates
    // within ±35 days of today; one or two months of history is plenty.
    supabase
      .from("payment_marks")
      .select("account_id, due_date")
      .eq("user_id", user.id)
      .gte("due_date", addDaysISO(today, -35))
      .lte("due_date", addDaysISO(today, 35)),
  ]);

  const allAccounts: Account[] = accountsRes.data ?? [];

  // Operator-tier entity filter (WS5). Non-operators see no filter chips
  // and never narrow the account set. Operators can scope every downstream
  // calc (net worth, projection, hints, pay-this-week, credit, etc.) by
  // picking a chip; default is "All" (combined view), matching grandma UX.
  const isOperator = profile?.is_operator ?? false;
  let entities: Entity[] = [];
  if (isOperator) {
    const { data: entRows } = await supabase
      .from("entities")
      .select("*")
      .order("is_personal", { ascending: false })
      .order("created_at", { ascending: true });
    entities = (entRows ?? []) as Entity[];
  }

  const accounts: Account[] = !entityFilter
    ? allAccounts
    : entityFilter === "untagged"
      ? allAccounts.filter((a) => a.entity_id == null)
      : allAccounts.filter((a) => a.entity_id === entityFilter);
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
  // per account on/before 7 days ago. M4: only show this when EVERY active
  // account has a ≥7-day-old snapshot — otherwise the whole-portfolio delta
  // isn't real (a newly-connected account has no baseline, so its full
  // balance would masquerade as a week's change). When any baseline is
  // missing we hide the figure rather than blend current balances in.
  const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekAgoBalById = new Map<string, number>();
  for (const s of snapshots90d) {
    if (new Date(s.captured_at).getTime() <= weekAgoMs) {
      weekAgoBalById.set(s.account_id, Number(s.balance)); // ascending → last wins
    }
  }
  const everyAccountHasBaseline =
    accounts.length > 0 && accounts.every((a) => weekAgoBalById.has(a.id));
  let weekAgoNet = 0;
  if (everyAccountHasBaseline) {
    for (const a of accounts) {
      const bal = weekAgoBalById.get(a.id) as number;
      weekAgoNet += bal * (a.category === "asset" ? 1 : -1);
    }
  }
  const weekChange = everyAccountHasBaseline
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
  const hasCreditCards = accounts.some(
    (a) =>
      a.category === "debt" &&
      a.credit_limit != null &&
      Number(a.credit_limit) > 0
  );

  // Pay-this-week queue (WS3): aggregate upcoming + overdue debt payments
  // and subtract anything the user has marked paid.
  const paidMarks = new Set(
    (paymentMarksRes.data ?? []).map(
      (m) => `${m.account_id as string}:${m.due_date as string}`
    )
  );
  const upcomingPayments = buildUpcomingPayments(accounts, paidMarks);

  // Onboarding (WS3). Silent locale detection runs once; the welcome moment
  // fires once after the first balance lands; the getting-started checklist
  // shows for the first week until 3 of 4 are done.
  const needsLocaleDetect = !(profile?.locale_detected ?? false);
  const showWelcome = hasAccounts && !(profile?.welcomed ?? false);

  const hasAnyCheckin = checkinDates.length > 0;
  const hasSecondaryAccount =
    accounts.length >= 2 ||
    accounts.some((a) => a.account_type !== "bank" && a.account_type !== "cash");
  const gettingStartedItems = [
    { label: "Connected your first bank", done: hasAccounts, href: "/app/accounts/add" },
    { label: "Do your first check-in", done: hasAnyCheckin, href: "/app/checkin" },
    { label: "Add a credit card or investment", done: hasSecondaryAccount, href: "/app/accounts/add" },
    { label: "Set your home currency", done: profile?.locale_detected ?? false, href: "/app/settings" },
  ];
  const gettingStartedDone = gettingStartedItems.filter((i) => i.done).length;
  const daysSinceSignup = profile?.created_at
    ? (Date.now() - new Date(profile.created_at).getTime()) / (24 * 60 * 60 * 1000)
    : 0;
  const showGettingStarted =
    hasAccounts && gettingStartedDone < 3 && daysSinceSignup < 7;

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
      {needsLocaleDetect && <LocaleDetector />}
      {showWelcome && (
        <WelcomeMoment
          netWorthFormatted={formatBalance(netWorth, homeCurrency, {
            roundWholeAbove1000: true,
          })}
        />
      )}

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
            {entityFilter && entityFilter !== "untagged"
              ? `${entities.find((e) => e.id === entityFilter)?.name ?? "Filtered"} net worth`
              : entityFilter === "untagged"
                ? "Untagged net worth"
                : "Net worth"}
          </span>
          <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent-primary">
            {homeCurrency}
          </span>
        </div>
        <div className="mt-2 text-[44px] font-bold leading-none tracking-[-0.03em] tabular-nums text-text-primary">
          {formatBalance(netWorth, homeCurrency, { roundWholeAbove1000: true })}
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

      {/* Operator-only entity filter — narrows net worth, payments, accounts,
          and hints to the selected business */}
      {isOperator && entities.length > 0 && (
        <EntityFilter entities={entities} selected={entityFilter} />
      )}

      {hasAccounts ? (
        <>
          {showGettingStarted && (
            <GettingStartedCard items={gettingStartedItems} />
          )}

          {/* Pay-this-week (renders nothing when nothing's due) */}
          <PayThisWeek
            payments={upcomingPayments}
            homeCurrency={homeCurrency}
          />

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

          {hasCreditCards && (
            <Link
              href="/app/credit"
              className="mt-2 flex items-center justify-between rounded-card border border-text-primary/8 bg-bg-tertiary p-4 transition hover:shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent-primary">
                  <CreditCard className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-medium text-text-primary">
                    Credit use
                  </div>
                  <div className="text-[11px] text-text-muted">
                    How much of your credit you&apos;re using right now
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-text-muted" />
            </Link>
          )}

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
        // Onboarding empty state — one welcome, one button (60-second rule).
        <section className="mt-10 flex flex-col items-center text-center">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-primary">
            Welcome to Vigilance
          </div>
          <h2 className="text-balance text-[28px] font-bold leading-tight tracking-[-0.025em] text-text-primary">
            Let&apos;s see what you have.
          </h2>
          <p className="mx-auto mt-3 max-w-[300px] text-[15px] leading-relaxed text-text-secondary">
            Connect a bank and your net worth shows up in about 30 seconds.
          </p>
          <Link
            href="/app/accounts/add"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent-primary px-7 py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Connect your first bank
          </Link>
          <p className="mt-4 text-[11px] text-text-muted">
            Read-only. We never move your money.
          </p>
        </section>
      )}
    </>
  );
}
