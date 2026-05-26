import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ReckoningClient } from "./reckoning-client";
import { createClient } from "@/lib/supabase/server";
import { toDecimal, type Currency } from "@/lib/money";
import {
  biggestMovers,
  dailyNetWorthSeries,
  endOfWeekSunday,
  formatISODate,
  startOfWeekMonday,
  type RawSnapshot,
} from "@/lib/rituals";
import type { Account } from "@/lib/types";

function sumNetWorthAt(points: ReturnType<typeof dailyNetWorthSeries>, when: "first" | "last"): number | null {
  const sequence = when === "first" ? points : [...points].reverse();
  for (const p of sequence) if (p.netWorth != null) return p.netWorth;
  return null;
}

export default async function ReckoningPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const weekStart = startOfWeekMonday();
  const weekEnd = endOfWeekSunday(weekStart);
  // Pull a slightly wider window so the chart can extrapolate from
  // pre-Monday snapshots if needed (we display 7 days but math uses 14).
  const windowStart = new Date(weekStart);
  windowStart.setDate(windowStart.getDate() - 7);

  const [accountsRes, snapshotsRes, profileRes, reflectionRes] =
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
        .from("weekly_reflections")
        .select("reflection_text")
        .eq("user_id", user.id)
        .eq("week_starting", formatISODate(weekStart))
        .maybeSingle(),
    ]);

  const accounts: Account[] = accountsRes.data ?? [];
  const snapshots: RawSnapshot[] = (snapshotsRes.data ?? []) as RawSnapshot[];
  const homeCurrency: Currency =
    (profileRes.data?.home_currency as Currency) ?? "USD";
  const existingReflection = reflectionRes.data?.reflection_text ?? null;

  const series = dailyNetWorthSeries(accounts, snapshots, weekStart, weekEnd);
  const movers = biggestMovers(accounts, snapshots, weekStart, 3);

  const netWorthStart = sumNetWorthAt(series, "first");
  // For the END value, prefer the "as of now" computed net worth from the
  // current account balances rather than what's in the 7-day series — the
  // series may stop short for today if no snapshot fired.
  const netWorthEnd = accounts.reduce(
    (s, a) => s.plus(toDecimal(a.balance).times(a.category === "asset" ? 1 : -1)),
    toDecimal(0)
  ).toNumber();

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
          Sunday Reckoning
        </div>
        <div className="w-9" />
      </header>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-[-0.025em] text-text-primary">
          Reckoning
        </h1>
        <div className="mt-1 text-sm text-text-secondary">
          Week of{" "}
          {weekStart.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}{" "}
          –{" "}
          {weekEnd.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </div>
      </div>

      {accounts.length === 0 ? (
        <section className="mt-12 flex flex-col items-center text-center">
          <p className="mb-6 max-w-[300px] text-sm leading-relaxed text-text-secondary">
            Add at least one account before the weekly reckoning has data to
            reflect on.
          </p>
          <Link
            href="/app/accounts/add"
            className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Connect your bank
          </Link>
        </section>
      ) : (
        <ReckoningClient
          weekStarting={formatISODate(weekStart)}
          homeCurrency={homeCurrency}
          netWorthStart={netWorthStart}
          netWorthEnd={netWorthEnd}
          series={series}
          movers={movers}
          existingReflection={existingReflection}
        />
      )}
    </>
  );
}
