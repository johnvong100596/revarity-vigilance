import Decimal from "decimal.js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { convert, type RateResolver } from "@/lib/fx";
import type { Currency } from "@/lib/money";
import type { Account, Iou } from "@/lib/types";

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

/**
 * Return copies of `accounts` with every money field (balance, min_payment,
 * credit_limit) converted to `home` and `currency` set to `home`, so any
 * consumer that sums them is currency-correct without changing its own code.
 *
 * Fail-safe: if an account's rate is missing the row is returned UNCHANGED
 * (original value + original currency), so behavior is unchanged until the
 * fx_rates feed is populated. apr is a rate, not money — left alone.
 */
export async function normalizeAccountsToHome(
  accounts: Account[],
  home: Currency,
  resolveRate: RateResolver
): Promise<Account[]> {
  const out: Account[] = [];
  for (const a of accounts) {
    const from = (a.currency as Currency) ?? home;
    if (from === home) {
      out.push(a);
      continue;
    }
    try {
      const balance = (await convert(a.balance, from, home, resolveRate)).toNumber();
      const min_payment =
        a.min_payment == null
          ? a.min_payment
          : (await convert(a.min_payment, from, home, resolveRate)).toNumber();
      const credit_limit =
        a.credit_limit == null
          ? a.credit_limit
          : (await convert(a.credit_limit, from, home, resolveRate)).toNumber();
      out.push({ ...a, balance, min_payment, credit_limit, currency: home });
    } catch {
      out.push(a); // missing rate → leave unchanged
    }
  }
  return out;
}

/**
 * Return copies of `ious` with `amount` converted to `home` and `currency` set
 * to `home`. Same fail-safe as normalizeAccountsToHome.
 */
export async function normalizeIousToHome(
  ious: Iou[],
  home: Currency,
  resolveRate: RateResolver
): Promise<Iou[]> {
  const out: Iou[] = [];
  for (const i of ious) {
    const from = (i.currency as Currency) ?? home;
    if (from === home) {
      out.push(i);
      continue;
    }
    try {
      const amount = (await convert(i.amount, from, home, resolveRate)).toNumber();
      out.push({ ...i, amount, currency: home });
    } catch {
      out.push(i);
    }
  }
  return out;
}
