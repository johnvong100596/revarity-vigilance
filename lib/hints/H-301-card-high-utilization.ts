import type { HintEvaluator } from "./types";

/**
 * H-301: any single credit card is >70% used. Complements H-002 (which is
 * the urgent "bill cuts in N days" version) by firing on high utilization
 * even when there's no statement-close date in range — so a card with
 * unknown / distant statement close still surfaces a heads-up.
 */

const HIGH_CARD_UTILIZATION = 0.7;
const H002_URGENT_WINDOW_DAYS = 7;

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

export const H301: HintEvaluator = {
  id: "H-301",
  templateId: "H-301-card-high-utilization",
  severity: "pay_attention",
  title: "Card is heavily used",
  eval(ctx) {
    const today = new Date();
    const cards = ctx.accounts.filter(
      (a) =>
        a.category === "debt" &&
        a.credit_limit != null &&
        Number(a.credit_limit) > 0 &&
        Number(a.balance) > 0
    );

    // Pick the card with the highest utilization. If H-002 would already
    // fire for it (statement close in 7 days), we yield to H-002 so the user
    // doesn't get two hints about the same card.
    let worst: { id: string; name: string; util: number; yields: boolean } | null = null;
    for (const card of cards) {
      const util = Number(card.balance) / Number(card.credit_limit);
      if (util < HIGH_CARD_UTILIZATION) continue;
      const yields =
        card.statement_close_day != null &&
        daysUntilDayOfMonth(today, Number(card.statement_close_day)) <=
          H002_URGENT_WINDOW_DAYS;
      if (!worst || util > worst.util) {
        worst = { id: card.id, name: card.name, util, yields };
      }
    }

    if (!worst || worst.yields) return { fires: false };

    const pct = Math.round(worst.util * 100);
    return {
      fires: true,
      relatedAccountId: worst.id,
      body: `Your ${worst.name} is ${pct}% used. Paying it down — or putting purchases on a less-used card — keeps your credit score healthier.`,
      data: { utilization: worst.util },
      actionLabel: "See credit use",
      actionTarget: "/app/credit",
    };
  },
};
