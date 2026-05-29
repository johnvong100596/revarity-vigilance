import { NextResponse, type NextRequest } from "next/server";

import SundayReckoningEmail from "@/lib/email/SundayReckoningEmail";
import { sendEmail } from "@/lib/email/send";
import { formatBalance, type Currency } from "@/lib/money";
import {
  dailyNetWorthSeries,
  endOfWeekSunday,
  startOfWeekMonday,
  type RawSnapshot,
} from "@/lib/rituals";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TIMEZONE, daysBetweenISO, localDateISO } from "@/lib/time";
import type { Account, Hint } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — Vercel cron default

/**
 * Sunday Reckoning weekly email.
 *
 * Trigger: Vercel cron, configured in vercel.json to run Sundays at
 * 16:00 UTC (8am PT). Future enhancement: per-user timezones.
 *
 * Authentication: Vercel adds Authorization: Bearer $CRON_SECRET to
 * cron requests. We REQUIRE CRON_SECRET to be set (fail-closed). If
 * the env var is missing the route returns 503 — never accept an
 * anonymous request, even in dev. To run locally, export CRON_SECRET
 * and pass the header on curl.
 *
 * Sends only to users with profile.weekly_email_enabled = true. Skips
 * users whose last touch is 14+ days ago (they get the re-engagement
 * path, not the weekly summary). Logs per-user send result, returns
 * summary counts.
 */
// Vercel Cron invokes the configured path with GET, so the scheduled run must
// have a GET handler or it 405s and never executes. Delegate to POST (kept for
// manual/curl invocation). The Bearer CRON_SECRET check below applies to both
// verbs — this is NOT an unauthenticated alias.
export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch users with weekly email enabled, joined with auth.users for email
  const { data: profiles } = await admin
    .from("profiles")
    .select(
      "id, display_name, home_currency, active_workspace_id, awareness_streak, last_checkin_date, timezone"
    )
    .eq("weekly_email_enabled", true);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 });
  }

  const today = new Date();
  const weekStart = startOfWeekMonday(today);
  const weekEnd = endOfWeekSunday(weekStart);
  const windowStart = new Date(weekStart);
  windowStart.setDate(windowStart.getDate() - 7);

  let sent = 0;
  let skipped = 0;
  const failures: { userId: string; reason: string }[] = [];

  for (const p of profiles) {
    try {
      // Pull email from auth.users
      const { data: authUser } = await admin.auth.admin.getUserById(p.id);
      const email = authUser?.user?.email;
      if (!email) {
        skipped++;
        continue;
      }

      // Skip if user is in re-engagement territory (14+ days no touch).
      // They'll get a different email — not the weekly happy path.
      // Calendar-day diff in the user's own timezone (H5) so the boundary
      // is their local midnight, not UTC's.
      if (p.last_checkin_date) {
        const tz = (p.timezone as string) || DEFAULT_TIMEZONE;
        const idleDays = daysBetweenISO(
          p.last_checkin_date as string,
          localDateISO(tz)
        );
        if (idleDays >= 14) {
          skipped++;
          continue;
        }
      }

      const [accountsRes, snapshotsRes, hintsRes] = await Promise.all([
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
          .select("*")
          .eq("workspace_id", p.active_workspace_id)
          .eq("status", "active")
          .order("severity_score", { ascending: false })
          .limit(3),
      ]);

      const accounts = (accountsRes.data ?? []) as Account[];
      if (accounts.length === 0) {
        skipped++;
        continue;
      }
      const snapshots = (snapshotsRes.data ?? []) as RawSnapshot[];
      const hints = (hintsRes.data ?? []) as Hint[];

      const series = dailyNetWorthSeries(accounts, snapshots, weekStart, weekEnd);
      const start = series.find((s) => s.netWorth != null)?.netWorth ?? 0;
      const end = accounts.reduce(
        (sum, a) =>
          sum + Number(a.balance) * (a.category === "asset" ? 1 : -1),
        0
      );
      const change = end - start;
      const currency = (p.home_currency as Currency) ?? "USD";

      const result = await sendEmail({
        to: email,
        subject: `Your Sunday Reckoning — ${change >= 0 ? "+" : "−"}${formatBalance(Math.abs(change), currency)} this week`,
        component: SundayReckoningEmail({
          displayName: p.display_name || "there",
          netWorthChange: `${change >= 0 ? "+" : "−"}${formatBalance(Math.abs(change), currency)}`,
          netWorthChangeIsPositive: change >= 0,
          topHints: hints.map((h) => ({
            body: h.composed_body ?? h.body,
            severity: h.category,
          })),
          weekStreak: Math.floor((p.awareness_streak ?? 0) / 7),
          deepLink: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://vigilance.revarity.com"}/app/reckoning`,
        }),
      });
      if (result.sent) sent++;
      else if (result.skipped) {
        // Resend not configured yet — benign, not a failure
        skipped++;
      } else {
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

// Vercel cron uses POST. Don't alias GET — a GET alias makes the route
// a one-curl drive-by trigger for the entire email blast.
