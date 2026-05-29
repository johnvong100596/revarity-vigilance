import Decimal from "decimal.js";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { RateResolver } from "@/lib/fx";
import type { Currency } from "@/lib/money";

/**
 * Build a RateResolver from the USD-base `fx_rates` table. It preloads the
 * latest USD→target rate for every currency in ONE query, then resolves any
 * pair by triangulating through USD:
 *
 *   rate(from→to) = (USD→to) / (USD→from)
 *
 * So convert() works for any pair (EUR→CAD etc.), not just USD-anchored ones.
 *
 * If the table is empty (the fx-refresh cron hasn't populated it yet) the
 * resolver returns null for cross-currency pairs, so convert() throws and
 * callers fall back to the raw balance — i.e. behavior is unchanged until rates
 * exist. Same-currency conversions never need a rate.
 */
export async function makeRateResolver(
  supabase: SupabaseClient
): Promise<RateResolver> {
  const { data } = await supabase
    .from("fx_rates")
    .select("target_currency, rate, captured_at")
    .eq("base_currency", "USD")
    .order("captured_at", { ascending: false });

  // Newest row per target wins (rows are sorted newest-first).
  const usdTo = new Map<string, Decimal>();
  for (const row of data ?? []) {
    const t = row.target_currency as string;
    if (!usdTo.has(t)) usdTo.set(t, new Decimal(row.rate as number));
  }
  usdTo.set("USD", new Decimal(1));

  return async (from: Currency, to: Currency): Promise<Decimal | null> => {
    if (from === to) return new Decimal(1);
    const f = usdTo.get(from);
    const t = usdTo.get(to);
    if (!f || !t || f.isZero()) return null;
    return t.dividedBy(f);
  };
}
