import type { Account } from "@/lib/types";

/**
 * Pay-this-week queue (v1.1 WS3). Aggregates upcoming due dates from
 * debt accounts that have a payment_due_day (set by Plaid Liabilities
 * for credit cards / mortgages / student loans). Excludes anything the
 * user has marked paid for the current cycle's due date.
 *
 * Future sources to add (when their feeds land):
 *   - Plaid Recurring Transactions → subscriptions
 *   - WS6 IOUs with due_date set
 */

export interface UpcomingPayment {
  accountId: string;
  accountName: string;
  amount: number;
  currency: string;
  /** ISO YYYY-MM-DD of the next due date */
  dueDate: string;
  /** True when due_date is in the past */
  isOverdue: boolean;
  /** True when the user has marked this cycle paid */
  isPaid: boolean;
  /** Days until due (negative = overdue). */
  daysUntil: number;
  source: "credit_card" | "mortgage" | "loan";
}

function nextDueDateFromDayOfMonth(from: Date, day: number): Date {
  const y = from.getFullYear();
  const m = from.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const clamped = Math.min(day, daysInMonth);
  let target = new Date(y, m, clamped);
  target.setHours(0, 0, 0, 0);
  const todayStart = new Date(from);
  todayStart.setHours(0, 0, 0, 0);
  if (target.getTime() < todayStart.getTime()) {
    const nextDays = new Date(y, m + 2, 0).getDate();
    target = new Date(y, m + 1, Math.min(day, nextDays));
    target.setHours(0, 0, 0, 0);
  }
  return target;
}

function previousDueDateFromDayOfMonth(from: Date, day: number): Date {
  // Used to detect "overdue this cycle": the most recent calendar
  // occurrence of `day` on/before today.
  const y = from.getFullYear();
  const m = from.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const clamped = Math.min(day, daysInMonth);
  const target = new Date(y, m, clamped);
  target.setHours(0, 0, 0, 0);
  const todayStart = new Date(from);
  todayStart.setHours(0, 0, 0, 0);
  if (target.getTime() <= todayStart.getTime()) return target;
  // Roll back one month
  const prevDays = new Date(y, m, 0).getDate();
  const prev = new Date(y, m - 1, Math.min(day, prevDays));
  prev.setHours(0, 0, 0, 0);
  return prev;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function classifySource(a: Account): UpcomingPayment["source"] {
  const text = `${a.subtitle ?? ""} ${a.name ?? ""}`.toLowerCase();
  if (/mortgage|home loan|heloc/.test(text)) return "mortgage";
  if (/student|auto|car loan|personal loan|loan/.test(text)) return "loan";
  return "credit_card";
}

/**
 * Build the upcoming-payments list for the home widget. Returns rows for
 * accounts due within `daysAhead` days OR overdue this cycle. `paidMarks`
 * is a set of `${accountId}:${dueDateISO}` keys; matching rows are flagged
 * isPaid but still included so the user can un-mark if they tapped by
 * mistake.
 */
export function buildUpcomingPayments(
  accounts: Account[],
  paidMarks: Set<string>,
  daysAhead: number = 7,
  now: Date = new Date()
): UpcomingPayment[] {
  const rows: UpcomingPayment[] = [];
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  for (const a of accounts) {
    if (a.category !== "debt") continue;
    if (a.payment_due_day == null) continue;
    const day = Number(a.payment_due_day);
    if (!Number.isFinite(day) || day < 1 || day > 31) continue;

    // Two windows of interest:
    //   1) the previous occurrence (most recent on/before today) — overdue if
    //      not paid for that cycle
    //   2) the next occurrence (after today) — upcoming if within daysAhead
    const previous = previousDueDateFromDayOfMonth(now, day);
    const next = nextDueDateFromDayOfMonth(now, day);
    const minPayment = a.min_payment != null ? Number(a.min_payment) : 0;

    // Overdue (previous cycle not marked paid)
    const prevIso = toISODate(previous);
    const prevPaid = paidMarks.has(`${a.id}:${prevIso}`);
    if (!prevPaid && previous.getTime() < todayStart.getTime()) {
      const daysUntil = Math.round(
        (previous.getTime() - todayStart.getTime()) / 86400000
      );
      rows.push({
        accountId: a.id,
        accountName: a.name,
        amount: minPayment,
        currency: a.currency,
        dueDate: prevIso,
        isOverdue: true,
        isPaid: false,
        daysUntil,
        source: classifySource(a),
      });
    }

    // Upcoming (next cycle within daysAhead)
    const nextIso = toISODate(next);
    const daysUntil = Math.round(
      (next.getTime() - todayStart.getTime()) / 86400000
    );
    if (daysUntil >= 0 && daysUntil <= daysAhead) {
      const nextPaid = paidMarks.has(`${a.id}:${nextIso}`);
      rows.push({
        accountId: a.id,
        accountName: a.name,
        amount: minPayment,
        currency: a.currency,
        dueDate: nextIso,
        isOverdue: false,
        isPaid: nextPaid,
        daysUntil,
        source: classifySource(a),
      });
    }
  }

  // Soonest first (overdue most negative → soonest first)
  return rows.sort((x, y) => x.daysUntil - y.daysUntil);
}
