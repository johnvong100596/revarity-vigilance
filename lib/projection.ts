import { toDecimal } from "@/lib/money";
import type { Account } from "@/lib/types";
import type { RawSnapshot } from "@/lib/rituals";

export interface ProjectionPoint {
  date: number; // unix ms
  projected: number;
}

/**
 * Forward-project net worth over `years` from now. Two signals combined:
 *   - 90-day slope from balance_snapshots, projected linearly
 *   - Debt amortization: for each debt account with an APR and a
 *     min_payment, simulate monthly paydown (principal + interest)
 *
 * Returns ~24 sample points per year (~2/month) so the recharts area
 * curve is smooth without exploding the payload.
 *
 * Simplifications (Day 2-of-v1 grade — refine later):
 * - Assumes the snapshot slope continues — no asset-class differentiation
 * - Debt amortization treats min_payment as constant monthly outflow
 *   against the debt balance (so net worth gets a positive lift from
 *   debt being paid down faster than the trend implies)
 * - Doesn't model new income or contributions — strictly trajectory math
 */
export function projectNetWorth(
  accounts: Account[],
  snapshots: RawSnapshot[],
  years: number,
  now: Date = new Date()
): ProjectionPoint[] {
  if (accounts.length === 0) return [];

  // Current net worth
  let current = 0;
  for (const a of accounts) {
    current += Number(a.balance) * (a.category === "asset" ? 1 : -1);
  }

  // 90-day slope from snapshots, summed across accounts. Calculate the
  // net-worth value at oldest snapshot in window vs now, divide by days.
  const ms90 = 90 * 24 * 60 * 60 * 1000;
  const ninetyDaysAgo = now.getTime() - ms90;
  let oldestNet = current;
  let oldestTimestamp = now.getTime();

  // Take the EARLIEST snapshot per account inside the 90-day window
  const earliestByAccount = new Map<string, number>();
  const earliestTsByAccount = new Map<string, number>();
  for (const s of snapshots) {
    const ts = new Date(s.captured_at).getTime();
    if (ts < ninetyDaysAgo) continue;
    if (
      !earliestByAccount.has(s.account_id) ||
      ts < (earliestTsByAccount.get(s.account_id) ?? Infinity)
    ) {
      earliestByAccount.set(s.account_id, Number(s.balance));
      earliestTsByAccount.set(s.account_id, ts);
    }
  }
  if (earliestByAccount.size > 0) {
    oldestNet = 0;
    for (const a of accounts) {
      const balance =
        earliestByAccount.get(a.id) ?? Number(a.balance);
      oldestNet += balance * (a.category === "asset" ? 1 : -1);
    }
    oldestTimestamp = Math.min(...Array.from(earliestTsByAccount.values()));
  }
  const daysSpan = Math.max(
    1,
    (now.getTime() - oldestTimestamp) / (24 * 60 * 60 * 1000)
  );
  const dailySlope = (current - oldestNet) / daysSpan;

  // Debt amortization model. For each debt account with APR + min_payment,
  // simulate monthly: interest = balance * apr/12/100; principal =
  // min_payment - interest; new balance = old - principal. Bottom at 0.
  interface DebtAmortState {
    balance: number;
    aprMonthly: number;
    minPayment: number;
  }
  const debtStates: DebtAmortState[] = accounts
    .filter(
      (a) =>
        a.category === "debt" &&
        a.apr != null &&
        Number(a.apr) > 0 &&
        a.min_payment != null &&
        Number(a.min_payment) > 0
    )
    .map((a) => ({
      balance: Number(a.balance),
      aprMonthly: Number(a.apr) / 12 / 100,
      minPayment: Number(a.min_payment),
    }));

  const points: ProjectionPoint[] = [];
  const totalDays = Math.ceil(years * 365);
  const stepDays = Math.max(7, Math.floor(totalDays / 36)); // ~36 points

  // Track the debt-payoff delta vs straight-slope projection
  const initialDebtTotal = debtStates.reduce((s, d) => s + d.balance, 0);

  for (let d = 0; d <= totalDays; d += stepDays) {
    // Linear slope contribution
    const slopeContribution = dailySlope * d;

    // Debt amortization step — advance every 30 days
    const monthsElapsed = Math.floor(d / 30);
    let projectedDebtTotal = initialDebtTotal;
    if (monthsElapsed > 0 && debtStates.length > 0) {
      projectedDebtTotal = 0;
      for (const ds of debtStates) {
        let b = ds.balance;
        for (let m = 0; m < monthsElapsed && b > 0; m++) {
          const interest = b * ds.aprMonthly;
          const principal = Math.max(0, ds.minPayment - interest);
          b = Math.max(0, b - principal);
        }
        projectedDebtTotal += b;
      }
    }

    // Net worth = current + slope + amortization benefit (debt going down
    // faster than trend implies adds to net worth)
    const amortBenefit = initialDebtTotal - projectedDebtTotal;
    const projected = current + slopeContribution + amortBenefit;

    points.push({
      date: now.getTime() + d * 24 * 60 * 60 * 1000,
      projected: toDecimal(projected).toDecimalPlaces(2).toNumber(),
    });
  }

  return points;
}
