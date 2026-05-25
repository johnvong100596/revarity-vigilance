import type { Account } from "@/lib/types";

/**
 * Visible decay system — THESIS.md §4.
 *
 * Thresholds (days since the user last touched an account):
 *   0-2   fresh    no visual change
 *   3-6   warning  small amber dot next to account name
 *   7-13  stale    row desaturates (grayscale + opacity 0.7)
 *   14+   critical home-screen REENGAGE takeover, blocks ritual until ack
 *
 * "Touched" = max(last_acknowledged_at, created_at). The fallback to
 * created_at means a newly-added account that never gets acknowledged
 * still ages out (otherwise the decay clock would never start for users
 * who add accounts and forget).
 */

export type AccountDecayState = "fresh" | "warning" | "stale" | "critical";

export const DECAY_THRESHOLDS = {
  WARNING: 3,
  STALE: 7,
  CRITICAL: 14,
} as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / MS_PER_DAY));
}

export function lastTouchedAt(account: Account): string {
  return account.last_acknowledged_at ?? account.created_at;
}

export function daysSinceTouched(
  account: Account,
  now: Date = new Date()
): number {
  return daysSince(lastTouchedAt(account), now);
}

export function getAccountDecayState(
  account: Account,
  now: Date = new Date()
): AccountDecayState {
  const days = daysSinceTouched(account, now);
  if (days >= DECAY_THRESHOLDS.CRITICAL) return "critical";
  if (days >= DECAY_THRESHOLDS.STALE) return "stale";
  if (days >= DECAY_THRESHOLDS.WARNING) return "warning";
  return "fresh";
}

export interface UserDecaySummary {
  /** True if ANY account is past the critical threshold. */
  critical: boolean;
  /** Days since the user's most recent touch across all accounts. */
  daysSinceAnyTouch: number;
  /** Account list trimmed to the critical ones (for the takeover copy). */
  criticalAccounts: Account[];
}

export function getUserDecaySummary(
  accounts: Account[],
  now: Date = new Date()
): UserDecaySummary {
  if (accounts.length === 0) {
    return { critical: false, daysSinceAnyTouch: 0, criticalAccounts: [] };
  }
  const days = accounts.map((a) => daysSinceTouched(a, now));
  const minDays = Math.min(...days);
  const criticalAccounts = accounts.filter(
    (a) => daysSinceTouched(a, now) >= DECAY_THRESHOLDS.CRITICAL
  );
  return {
    critical: minDays >= DECAY_THRESHOLDS.CRITICAL,
    daysSinceAnyTouch: minDays,
    criticalAccounts,
  };
}
