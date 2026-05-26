import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CloseClient } from "./close-client";
import { createClient } from "@/lib/supabase/server";
import { toDecimal, type Currency, formatBalance } from "@/lib/money";
import {
  biggestMovers,
  categoryWaterfall,
  dailyNetWorthSeries,
  endOfMonth,
  formatYearMonth,
  startOfMonth,
  type RawSnapshot,
  type WaterfallRow,
} from "@/lib/rituals";
import type { Account } from "@/lib/types";

function autoWinsDrags(
  movers: ReturnType<typeof biggestMovers>
): { wins: string[]; drags: string[] } {
  const wins: string[] = [];
  const drags: string[] = [];
  for (const m of movers) {
    // For debt accounts: a negative delta = paid down = WIN.
    // For asset accounts: positive delta = WIN.
    const isWin = m.isDebt ? m.delta < 0 : m.delta > 0;
    const amount = formatBalance(Math.abs(m.delta), m.currency as Currency);
    const text = m.isDebt
      ? `${isWin ? "Paid down" : "Took on more"} ${m.name} by ${amount}`
      : `${m.name} ${isWin ? "up" : "down"} ${amount}`;
    (isWin ? wins : drags).push(text);
  }
  return { wins, drags };
}

export default async function MonthlyClosePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const monthStart = startOfMonth();
  const monthEnd = endOfMonth();
  const month = formatYearMonth(monthStart);

  const windowStart = new Date(monthStart);
  windowStart.setMonth(windowStart.getMonth() - 1);

  const [accountsRes, snapshotsRes, profileRes, lockedRes, weeklyRes] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("archived", false),
      supabase
        .from("balance_snapshots")
        .select("account_id, balance, captured_at")
        .eq("user_id", user.id)
        .gte("captured_at", windowStart.toISOString())
        .order("captured_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("home_currency")
        .eq("id", user.id)
        .single(),
      supabase
        .from("monthly_closes")
        .select("*")
        .eq("user_id", user.id)
        .eq("month", month)
        .maybeSingle(),
      supabase
        .from("weekly_reflections")
        .select("week_starting, reflection_text")
        .eq("user_id", user.id)
        .gte("week_starting", monthStart.toISOString().slice(0, 10))
        .lte("week_starting", monthEnd.toISOString().slice(0, 10))
        .order("week_starting", { ascending: true }),
    ]);

  const accounts: Account[] = accountsRes.data ?? [];
  const snapshots: RawSnapshot[] = (snapshotsRes.data ?? []) as RawSnapshot[];
  const homeCurrency: Currency =
    (profileRes.data?.home_currency as Currency) ?? "USD";

  const series = dailyNetWorthSeries(accounts, snapshots, monthStart, monthEnd);
  const waterfall = categoryWaterfall(accounts, snapshots, monthStart);

  const seriesFirst = series.find((p) => p.netWorth != null)?.netWorth ?? null;
  const netWorthEnd = accounts.length
    ? accounts
        .reduce(
          (s, a) =>
            s.plus(toDecimal(a.balance).times(a.category === "asset" ? 1 : -1)),
          toDecimal(0)
        )
        .toNumber()
    : null;

  const movers = biggestMovers(accounts, snapshots, monthStart, 5);
  const { wins: autoWins, drags: autoDrags } = autoWinsDrags(movers);

  const weeklyReflections = (weeklyRes.data ?? []).map((w) => ({
    weekStarting: w.week_starting as string,
    text: (w.reflection_text as string | null) ?? null,
  }));

  const locked = lockedRes.data
    ? {
        netWorth: (lockedRes.data.net_worth as number | null) ?? null,
        monthlyChange:
          (lockedRes.data.monthly_change as number | null) ?? null,
        waterfall:
          (lockedRes.data.waterfall_breakdown as WaterfallRow[] | null) ?? [],
        wins: ((lockedRes.data.wins as string[] | null) ?? []) as string[],
        drags: ((lockedRes.data.drags as string[] | null) ?? []) as string[],
        notes: (lockedRes.data.notes as string | null) ?? "",
        lockedAt: lockedRes.data.locked_at as string,
      }
    : null;

  return (
    <>
      <header className="mb-8 flex items-center justify-between">
        <Link
          href="/app"
          aria-label="Back"
          className="-m-2 p-2 text-text-secondary transition hover:text-text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Monthly Close
        </div>
        <div className="w-9" />
      </header>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-[-0.025em] text-text-primary">
          Close
        </h1>
        <div className="mt-1 text-sm text-text-secondary">
          {monthStart.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>

      {accounts.length === 0 ? (
        <section className="mt-12 flex flex-col items-center text-center">
          <p className="mb-6 max-w-[300px] text-sm leading-relaxed text-text-secondary">
            Add at least one account before the monthly close has anything to
            measure.
          </p>
          <Link
            href="/app/accounts/add"
            className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Add account
          </Link>
        </section>
      ) : (
        <CloseClient
          month={month}
          homeCurrency={homeCurrency}
          netWorthStart={seriesFirst}
          netWorthEnd={netWorthEnd}
          series={series}
          waterfall={waterfall}
          autoWins={autoWins}
          autoDrags={autoDrags}
          weeklyReflections={weeklyReflections}
          locked={locked}
        />
      )}
    </>
  );
}
