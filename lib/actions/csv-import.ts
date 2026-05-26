"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const ImportInput = z.object({
  accountId: z.string().uuid(),
  csvText: z.string().min(1).max(200_000), // 200 KB cap
});

interface ParsedRow {
  date: string; // ISO YYYY-MM-DD
  balance: number;
}

/**
 * Parses Scotiabank-style CSV exports. Their format (as of 2026):
 *   "Date","Description","Sub-description","Status","Type of Transaction","Funds Out","Funds In","Balance"
 *
 * We don't care about transaction-level rows — we just snapshot the
 * Balance column per Date so the user gets a backfilled history chart.
 *
 * Generic-fallback: if columns are auto-detected as Date + Balance only
 * (any header containing "date" + "balance"), the same path works.
 *
 * Skips rows that can't be parsed cleanly. Returns the parsed rows for
 * the UI to preview before commit.
 */
export async function parseScotiaCsv(csvText: string): Promise<ParsedRow[]> {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const cells = header.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
  const dateIdx = cells.findIndex((c) => c.includes("date"));
  const balanceIdx = cells.findIndex((c) => c.includes("balance"));
  if (dateIdx < 0 || balanceIdx < 0) return [];

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    // Naive CSV split — handles unquoted Scotia exports. For fully
    // RFC-4180-correct parsing we'd need a real parser; sufficient
    // for the export formats supported here.
    const parts = raw.split(",").map((p) => p.replace(/^"|"$/g, "").trim());
    const dateStr = parts[dateIdx];
    const balanceStr = parts[balanceIdx];
    if (!dateStr || !balanceStr) continue;

    const balance = Number(balanceStr.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(balance)) continue;

    // Scotia uses MM/DD/YYYY or YYYY-MM-DD
    let isoDate: string | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      isoDate = dateStr;
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      const [m, d, y] = dateStr.split("/");
      isoDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    } else {
      continue;
    }

    rows.push({ date: isoDate, balance });
  }

  // Dedupe by date — keep the LAST snapshot in the day (CSV typically
  // ordered chronological-ascending so the running balance is at the end)
  const byDate = new Map<string, number>();
  for (const r of rows) byDate.set(r.date, r.balance);

  return Array.from(byDate, ([date, balance]) => ({ date, balance })).sort(
    (a, b) => (a.date < b.date ? -1 : 1)
  );
}

export async function importCsvHistory(input: {
  accountId: string;
  csvText: string;
}): Promise<{ imported: number; skipped: number }> {
  const { accountId, csvText } = ImportInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: account } = await supabase
    .from("accounts")
    .select("workspace_id, currency")
    .eq("id", accountId)
    .single();
  if (!account?.workspace_id) {
    throw new Error("Account not found or not in your workspace");
  }

  const rows = await parseScotiaCsv(csvText);
  if (rows.length === 0) {
    throw new Error(
      "Couldn't read that CSV. We look for Date + Balance columns — make sure both are in the export."
    );
  }

  // Build snapshot inserts. fx_rate = 1 only for USD accounts; multi-
  // currency conversion stays a Day-6 fx-cron concern.
  const fxRate = account.currency === "USD" ? 1 : null;
  const inserts = rows.map((r) => ({
    user_id: user.id,
    workspace_id: account.workspace_id,
    account_id: accountId,
    balance: r.balance,
    balance_home_currency: r.balance,
    fx_rate: fxRate,
    captured_at: new Date(r.date + "T12:00:00Z").toISOString(),
  }));

  const { error } = await supabase.from("balance_snapshots").insert(inserts);
  if (error) throw new Error(`CSV import failed: ${error.message}`);

  revalidatePath(`/app/accounts/${accountId}`);
  return { imported: inserts.length, skipped: 0 };
}
