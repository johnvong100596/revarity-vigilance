import { NextResponse, type NextRequest } from "next/server";

import { fetchUsdRates } from "@/lib/fx-source";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * FX refresh cron — populates the USD-base `fx_rates` table from the FX source.
 * This is the "rate feed" the rest of the FX code reads via makeRateResolver.
 *
 * Vercel Cron sends GET, so GET delegates to POST (POST kept for manual runs).
 * Fail-closed behind Bearer $CRON_SECRET on both verbs.
 *
 * Idempotent per UTC day: the fx_rates unique index is (base, target, day-UTC),
 * which is an expression index PostgREST can't target with upsert(onConflict),
 * so we delete today's USD rows and re-insert — a re-run refreshes rather than
 * duplicates.
 */
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
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let usd;
  try {
    usd = await fetchUsdRates();
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch failed";
    console.error("[cron/fx-refresh]", message);
    return NextResponse.json({ error: "FX fetch failed" }, { status: 502 });
  }

  const rows = Object.entries(usd.rates).map(([target, rate]) => ({
    base_currency: "USD",
    target_currency: target,
    rate,
    captured_at: usd.fetchedAt,
  }));
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, written: 0 });
  }

  const admin = createAdminClient();
  const startOfDayUtc = `${usd.fetchedAt.slice(0, 10)}T00:00:00.000Z`;

  // Clear today's USD rows first so the re-insert doesn't hit the per-day
  // unique index (delete window is sub-second on a 4-row set).
  const { error: delErr } = await admin
    .from("fx_rates")
    .delete()
    .eq("base_currency", "USD")
    .gte("captured_at", startOfDayUtc);
  if (delErr) {
    console.error("[cron/fx-refresh] clear failed:", delErr.message);
    return NextResponse.json({ error: "clear failed" }, { status: 500 });
  }

  const { error: insErr } = await admin.from("fx_rates").insert(rows);
  if (insErr) {
    console.error("[cron/fx-refresh] insert failed:", insErr.message);
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, written: rows.length });
}
