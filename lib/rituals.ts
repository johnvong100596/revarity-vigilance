import { toDecimal } from "@/lib/money";
import type { Account } from "@/lib/types";

export interface RawSnapshot {
  account_id: string;
  balance: number | string;
  balance_home_currency?: number | string | null;
  captured_at: string;
}

/* ── Date helpers ───────────────────────────────────────────────── */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function startOfWeekMonday(d: Date = new Date()): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun, 1=Mon … 6=Sat
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfWeekSunday(weekStarting: Date): Date {
  const d = new Date(weekStarting);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfMonth(d: Date = new Date()): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfMonth(d: Date = new Date()): Date {
  const date = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  date.setHours(23, 59, 59, 999);
  return date;
}

/** YYYY-MM-DD */
export function formatISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM */
export function formatYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ── Daily net-worth series ─────────────────────────────────────── */

export interface DailyPoint {
  date: Date;
  netWorth: number | null;
}

/**
 * Daily net worth over [start..end] inclusive. For each day, sum the
 * most-recent-at-or-before-end-of-day balance for each account.
 * Accounts with no prior snapshot AND no current balance applicable get
 * skipped. If no accounts contribute that day, netWorth is null.
 *
 * For the "today and future" cells, falls back to the current
 * account.balance so the line always extends to right-now.
 */
export function dailyNetWorthSeries(
  accounts: Account[],
  snapshots: RawSnapshot[],
  start: Date,
  end: Date
): DailyPoint[] {
  const sortedSnaps = [...snapshots].sort(
    (a, b) =>
      new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
  );
  const points: DailyPoint[] = [];
  const now = new Date();

  for (
    let cursor = new Date(start);
    cursor.getTime() <= end.getTime();
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const cutoff = new Date(cursor);
    cutoff.setHours(23, 59, 59, 999);

    let sum = toDecimal(0);
    let any = false;

    for (const account of accounts) {
      const sign = account.category === "asset" ? 1 : -1;
      // Most recent snapshot at or before this day's cutoff
      let chosen: RawSnapshot | null = null;
      for (const s of sortedSnaps) {
        if (s.account_id !== account.id) continue;
        if (new Date(s.captured_at).getTime() <= cutoff.getTime()) {
          chosen = s;
        } else break;
      }
      if (chosen) {
        sum = sum.plus(toDecimal(chosen.balance).times(sign));
        any = true;
      } else if (cutoff.getTime() >= now.getTime() - MS_PER_DAY) {
        // No snapshot in window but the day is "today or yesterday" —
        // use the current account balance so the line lands somewhere real
        sum = sum.plus(toDecimal(account.balance).times(sign));
        any = true;
      }
    }

    points.push({
      date: new Date(cursor),
      netWorth: any ? sum.toNumber() : null,
    });
  }

  return points;
}

/* ── Movers ─────────────────────────────────────────────────────── */

export interface MoverRow {
  accountId: string;
  name: string;
  subtitle: string | null;
  fromBalance: number;
  toBalance: number;
  delta: number;
  pct: number | null;
  isDebt: boolean;
  currency: Account["currency"];
}

/**
 * Top N accounts by absolute balance change between the first snapshot in
 * [start..end] (or the value at start if predates exist) and the current
 * account.balance.
 */
export function biggestMovers(
  accounts: Account[],
  snapshots: RawSnapshot[],
  start: Date,
  topN: number = 3
): MoverRow[] {
  const rows: MoverRow[] = [];
  for (const account of accounts) {
    const inWindow = snapshots
      .filter(
        (s) =>
          s.account_id === account.id &&
          new Date(s.captured_at).getTime() >= start.getTime()
      )
      .sort(
        (a, b) =>
          new Date(a.captured_at).getTime() -
          new Date(b.captured_at).getTime()
      );
    const beforeWindow = snapshots
      .filter(
        (s) =>
          s.account_id === account.id &&
          new Date(s.captured_at).getTime() < start.getTime()
      )
      .sort(
        (a, b) =>
          new Date(b.captured_at).getTime() -
          new Date(a.captured_at).getTime()
      );

    // Pick the "from" balance: either the latest pre-window snapshot OR
    // the first in-window snapshot if no priors exist
    const fromSnap = beforeWindow[0] ?? inWindow[0];
    if (!fromSnap) continue;
    const fromBalance = Number(fromSnap.balance);
    const toBalance = Number(account.balance);
    const delta = toBalance - fromBalance;
    if (Math.abs(delta) < 0.005) continue; // no meaningful change

    rows.push({
      accountId: account.id,
      name: account.name,
      subtitle: account.subtitle,
      fromBalance,
      toBalance,
      delta,
      pct: fromBalance !== 0 ? (delta / Math.abs(fromBalance)) * 100 : null,
      isDebt: account.category === "debt",
      currency: account.currency,
    });
  }
  rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return rows.slice(0, topN);
}

/* ── Net change per category (Monthly Close waterfall surrogate) ── */

export type WaterfallBucket =
  | "bank"
  | "cash"
  | "investment"
  | "crypto"
  | "loan";

export interface WaterfallRow {
  bucket: WaterfallBucket;
  label: string;
  delta: number;
}

const BUCKET_LABELS: Record<WaterfallBucket, string> = {
  bank: "Banking",
  cash: "Cash",
  investment: "Investments",
  crypto: "Crypto",
  loan: "Debt paid down",
};

export function categoryWaterfall(
  accounts: Account[],
  snapshots: RawSnapshot[],
  start: Date
): WaterfallRow[] {
  const deltaByBucket: Record<WaterfallBucket, number> = {
    bank: 0,
    cash: 0,
    investment: 0,
    crypto: 0,
    loan: 0,
  };

  for (const account of accounts) {
    const beforeWindow = snapshots
      .filter(
        (s) =>
          s.account_id === account.id &&
          new Date(s.captured_at).getTime() < start.getTime()
      )
      .sort(
        (a, b) =>
          new Date(b.captured_at).getTime() -
          new Date(a.captured_at).getTime()
      );
    const inWindow = snapshots
      .filter(
        (s) =>
          s.account_id === account.id &&
          new Date(s.captured_at).getTime() >= start.getTime()
      )
      .sort(
        (a, b) =>
          new Date(a.captured_at).getTime() -
          new Date(b.captured_at).getTime()
      );

    const fromSnap = beforeWindow[0] ?? inWindow[0];
    if (!fromSnap) continue;

    const from = Number(fromSnap.balance);
    const to = Number(account.balance);
    // For debt: paying it DOWN means balance dropped, which is a POSITIVE
    // net-worth event — so we negate the raw delta when displaying.
    const sign = account.category === "asset" ? 1 : -1;
    const delta = (to - from) * sign;
    deltaByBucket[account.account_type] += delta;
  }

  return (Object.keys(deltaByBucket) as WaterfallBucket[])
    .filter((b) => Math.abs(deltaByBucket[b]) > 0.005)
    .map((b) => ({ bucket: b, label: BUCKET_LABELS[b], delta: deltaByBucket[b] }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
