import { formatBalance, type Currency } from "@/lib/money";
import type { HintEvaluator } from "./types";

const UTILIZATION_THRESHOLD = 0.7; // 70% — bureaus start dinging credit scores
const TARGET_UTILIZATION = 0.3; // 30% — the safe-zone target
const DAYS_WINDOW = 7; // statement close inside this many days → urgent

/**
 * Days from `from` to the next calendar occurrence of `dayOfMonth`,
 * clamping for short months (e.g. day 31 in February becomes Feb 28/29).
 */
function daysUntilDayOfMonth(from: Date, dayOfMonth: number): number {
  const year = from.getFullYear();
  const month = from.getMonth();
  const daysInThisMonth = new Date(year, month + 1, 0).getDate();
  const clampedThis = Math.min(dayOfMonth, daysInThisMonth);
  let target = new Date(year, month, clampedThis);
  target.setHours(23, 59, 59, 999);
  if (target.getTime() <= from.getTime()) {
    const nextMonth = month + 1;
    const daysInNextMonth = new Date(year, nextMonth + 1, 0).getDate();
    target = new Date(year, nextMonth, Math.min(dayOfMonth, daysInNextMonth));
    target.setHours(23, 59, 59, 999);
  }
  return Math.ceil((target.getTime() - from.getTime()) / 86400000);
}

export const H002: HintEvaluator = {
  id: "H-002",
  templateId: "H-002-credit-utilization",
  severity: "pay_attention",
  title: "Credit utilization danger",
  eval(ctx) {
    const today = new Date();
    const cards = ctx.accounts.filter(
      (a) =>
        a.category === "debt" &&
        a.credit_limit != null &&
        Number(a.credit_limit) > 0 &&
        a.statement_close_day != null &&
        Number(a.balance) > 0
    );

    for (const card of cards) {
      const limit = Number(card.credit_limit);
      const balance = Number(card.balance);
      const utilization = balance / limit;
      if (utilization < UTILIZATION_THRESHOLD) continue;

      const daysToClose = daysUntilDayOfMonth(
        today,
        Number(card.statement_close_day)
      );
      if (daysToClose > DAYS_WINDOW) continue;

      const payoffNeeded = balance - limit * TARGET_UTILIZATION;
      const currency = card.currency as Currency;

      return {
        fires: true,
        relatedAccountId: card.id,
        body: `${card.name} hits ${Math.round(utilization * 100)}% utilization in ${daysToClose} day${daysToClose === 1 ? "" : "s"} at statement close. Pay ${formatBalance(payoffNeeded, currency)} before then to keep under 30% — preserves credit score for upcoming credit needs.`,
        data: {
          utilization,
          limit,
          balance,
          daysToClose,
          payoffNeeded,
          currency: card.currency,
        },
        actionLabel: "Open bank portal",
        actionTarget: card.quick_login_url ?? null,
      };
    }
    return { fires: false };
  },
};
