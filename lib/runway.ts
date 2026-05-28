import type { Account, Iou } from "@/lib/types";

/**
 * Cash runway (v1.1 WS7, operator-only). Given a set of accounts and
 * active IOUs scoped to an entity (or all entities for "All"), estimate
 * how many days the cash will last at the current 30-day net burn.
 *
 * Approximation given the data we have today:
 *   currentCash    = sum of bank/cash balances + cash-like investment
 *                    accounts (HISA, money-market) — assets only
 *   incoming(30d)  = owed_to_me IOUs due in next 30d + recurring owed_to_me
 *                    (monthly = once)
 *   outgoing(30d)  = i_owe IOUs due in next 30d + recurring i_owe (monthly
 *                    = once) + credit-card minimum payments (monthly = once
 *                    for each debt account with min_payment set)
 *   monthlyNet     = incoming − outgoing
 *   if monthlyNet ≥ 0 → SUSTAINABLE (no runway calculation)
 *   else runwayDays = floor(currentCash * 30 / burn)
 *
 * No daily-spend telemetry yet (Plaid Recurring Transactions still
 * ungranted), so day-by-day burn is approximated as monthly outflow / 30.
 */

const NOW_MS = () => Date.now();
const MS_PER_DAY = 86400000;

export interface RunwaySummary {
  currentCash: number;
  incoming30: number;
  outgoing30: number;
  monthlyNet: number;
  isSustainable: boolean;
  /** Days until cash hits zero at the current burn. Null when sustainable. */
  runwayDays: number | null;
  /** Approximate cash on day 30 if nothing changes. */
  projectedCashIn30: number;
}

function nextMonthlyOccurrenceWithinDays(
  dayOfMonth: number,
  days: number,
  now: Date = new Date()
): boolean {
  // day_of_month is validated 1–31 on write, but this pure helper can also be
  // reached by legacy rows and other callers. A 0 would make `new Date(y, m, 0)`
  // roll back to the prior month's last day — a silently wrong "occurrence" —
  // and NaN/fractional values are meaningless here. Anything outside an integer
  // 1–31 is treated as "no occurrence" rather than fabricating a date.
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    return false;
  }
  const y = now.getFullYear();
  const m = now.getMonth();
  const daysInThisMonth = new Date(y, m + 1, 0).getDate();
  const clampedThis = Math.min(dayOfMonth, daysInThisMonth);
  let target = new Date(y, m, clampedThis);
  target.setHours(0, 0, 0, 0);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (target.getTime() < start.getTime()) {
    const daysInNext = new Date(y, m + 2, 0).getDate();
    target = new Date(y, m + 1, Math.min(dayOfMonth, daysInNext));
    target.setHours(0, 0, 0, 0);
  }
  const diffDays = (target.getTime() - start.getTime()) / MS_PER_DAY;
  return diffDays >= 0 && diffDays <= days;
}

/**
 * Liquid cash for runway: bank and cash accounts always count. Investment-typed
 * accounts count only when the subtitle names a cash-like instrument (HISA,
 * money-market, high-interest savings, operating cash) — operators routinely
 * park working capital there. A plain brokerage/stock balance stays out:
 * counting it would overstate runway and hand a survival-mode operator false
 * comfort, the opposite of what this number is for.
 */
const CASH_LIKE_SUBTITLE =
  /\b(hisa|money market|high.?interest|savings|operating|cash)\b/i;

function isLiquidCash(a: Account): boolean {
  if (a.category !== "asset") return false;
  if (a.account_type === "bank" || a.account_type === "cash") return true;
  if (a.account_type === "investment" && a.subtitle != null) {
    return CASH_LIKE_SUBTITLE.test(a.subtitle);
  }
  return false;
}

export function calculateRunway(opts: {
  accounts: Account[];
  ious: Iou[];
  /** Window in days — default 30. */
  windowDays?: number;
  now?: Date;
}): RunwaySummary {
  const windowDays = opts.windowDays ?? 30;
  const now = opts.now ?? new Date(NOW_MS());

  const currentCash = opts.accounts.reduce(
    (sum, a) => (isLiquidCash(a) ? sum + Number(a.balance) : sum),
    0
  );

  // IOU contributions in the next windowDays
  let incoming = 0;
  let outgoing = 0;
  const startMs = new Date(now).setHours(0, 0, 0, 0);
  for (const iou of opts.ious) {
    if (iou.status !== "active") continue;
    const amt = Number(iou.amount);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    let landsInWindow = false;
    if (iou.due_date) {
      const due = new Date(iou.due_date + "T00:00:00").getTime();
      const days = (due - startMs) / MS_PER_DAY;
      if (days >= 0 && days <= windowDays) landsInWindow = true;
    }
    if (
      !landsInWindow &&
      iou.recurring &&
      iou.recurring.frequency === "monthly"
    ) {
      landsInWindow = nextMonthlyOccurrenceWithinDays(
        Number(iou.recurring.day_of_month),
        windowDays,
        now
      );
    }
    if (!landsInWindow) continue;
    if (iou.direction === "owed_to_me") incoming += amt;
    else outgoing += amt;
  }

  // Credit-card minimums: each debt account with min_payment + payment_due_day
  // contributes one monthly minimum to outgoing if its due day lands in window.
  for (const a of opts.accounts) {
    if (a.category !== "debt") continue;
    if (a.min_payment == null) continue;
    if (a.payment_due_day == null) continue;
    if (
      nextMonthlyOccurrenceWithinDays(
        Number(a.payment_due_day),
        windowDays,
        now
      )
    ) {
      outgoing += Number(a.min_payment);
    }
  }

  const monthlyNet = incoming - outgoing;
  const isSustainable = monthlyNet >= 0;
  const burn = isSustainable ? 0 : -monthlyNet;
  const runwayDays = isSustainable
    ? null
    : Math.max(0, Math.floor((currentCash * windowDays) / burn));
  const projectedCashIn30 = currentCash + monthlyNet;

  return {
    currentCash,
    incoming30: incoming,
    outgoing30: outgoing,
    monthlyNet,
    isSustainable,
    runwayDays,
    projectedCashIn30,
  };
}
