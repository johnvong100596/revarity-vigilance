import { NextResponse, type NextRequest } from "next/server";

import MonthlyCloseEmail from "@/lib/email/MonthlyCloseEmail";
import { sendEmail } from "@/lib/email/send";
import { formatBalance, type Currency } from "@/lib/money";
import {
  dailyNetWorthSeries,
  endOfMonth,
  startOfMonth,
  type RawSnapshot,
} from "@/lib/rituals";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Account } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Monthly Close email. Runs on the 1st of each month at 16:00 UTC (8am PT).
 * Same auth model as the Sunday Reckoning cron: optional CRON_SECRET
 * verification. Sends to users with monthly_email_enabled = true.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name, home_currency, active_workspace_id")
    .eq("monthly_email_enabled", true);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 });
  }

  // Compute for the month that just ENDED (run on the 1st = previous month)
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthStart = startOfMonth(previousMonth);
  const monthEnd = endOfMonth(previousMonth);
  const monthLabel = monthStart.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const windowStart = new Date(monthStart);
  windowStart.setMonth(windowStart.getMonth() - 1);

  let sent = 0;
  let skipped = 0;
  const failures: { userId: string; reason: string }[] = [];

  for (const p of profiles) {
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(p.id);
      const email = authUser?.user?.email;
      if (!email) {
        skipped++;
        continue;
      }

      const [accountsRes, snapshotsRes, hintsCountRes, hintsResolvedRes] =
        await Promise.all([
          admin
            .from("accounts")
            .select("*")
            .eq("workspace_id", p.active_workspace_id)
            .eq("archived", false),
          admin
            .from("balance_snapshots")
            .select("account_id, balance, captured_at")
            .eq("workspace_id", p.active_workspace_id)
            .gte("captured_at", windowStart.toISOString())
            .order("captured_at", { ascending: true }),
          admin
            .from("hints")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", p.active_workspace_id)
            .gte("fired_at", monthStart.toISOString())
            .lte("fired_at", monthEnd.toISOString()),
          admin
            .from("hints")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", p.active_workspace_id)
            .eq("status", "acted")
            .gte("acted_at", monthStart.toISOString())
            .lte("acted_at", monthEnd.toISOString()),
        ]);

      const accounts = (accountsRes.data ?? []) as Account[];
      if (accounts.length === 0) {
        skipped++;
        continue;
      }
      const snapshots = (snapshotsRes.data ?? []) as RawSnapshot[];
      const series = dailyNetWorthSeries(accounts, snapshots, monthStart, monthEnd);
      const start = series.find((s) => s.netWorth != null)?.netWorth ?? 0;
      const end =
        series
          .slice()
          .reverse()
          .find((s) => s.netWorth != null)?.netWorth ??
        accounts.reduce(
          (sum, a) =>
            sum + Number(a.balance) * (a.category === "asset" ? 1 : -1),
          0
        );
      const change = end - start;
      const currency = (p.home_currency as Currency) ?? "USD";

      const result = await sendEmail({
        to: email,
        subject: `${monthLabel} Close — ${change >= 0 ? "+" : "−"}${formatBalance(Math.abs(change), currency)}`,
        component: MonthlyCloseEmail({
          displayName: p.display_name || "there",
          monthLabel,
          netWorthChange: `${change >= 0 ? "+" : "−"}${formatBalance(Math.abs(change), currency)}`,
          netWorthChangeIsPositive: change >= 0,
          hintsFired: hintsCountRes.count ?? 0,
          hintsResolved: hintsResolvedRes.count ?? 0,
          bestStreakDay: null, // Future: compute from check_ins by day
          deepLink: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://vigilance.revarity.com"}/app/close`,
        }),
      });
      if (result.sent) sent++;
      else {
        skipped++;
        failures.push({ userId: p.id, reason: result.reason ?? "unknown" });
      }
    } catch (e) {
      failures.push({
        userId: p.id,
        reason: e instanceof Error ? e.message : "thrown",
      });
      skipped++;
    }
  }

  return NextResponse.json({ sent, skipped, failures });
}

export const GET = POST;
