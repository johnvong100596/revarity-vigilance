import type { HintEvaluator } from "./types";

/**
 * H-302: total credit use across all cards is >50%. Even if no single card
 * is dangerously high, the SUM matters for credit-bureau scoring.
 *
 * Aggregates only over accounts where a credit limit is set — accounts
 * without a limit (line-of-credit drawn without a known max, store cards)
 * are excluded so the percentage is honest.
 */

const TOTAL_THRESHOLD = 0.5;

export const H302: HintEvaluator = {
  id: "H-302",
  templateId: "H-302-total-utilization",
  severity: "pay_attention",
  title: "Total credit use is high",
  eval(ctx) {
    let totalLimit = 0;
    let totalBalance = 0;
    let cardCount = 0;
    for (const a of ctx.accounts) {
      if (a.category !== "debt") continue;
      const limit = a.credit_limit != null ? Number(a.credit_limit) : 0;
      if (limit <= 0) continue;
      totalLimit += limit;
      totalBalance += Number(a.balance);
      cardCount++;
    }
    if (cardCount === 0 || totalLimit === 0) return { fires: false };

    const total = totalBalance / totalLimit;
    if (total < TOTAL_THRESHOLD) return { fires: false };

    const pct = Math.round(total * 100);
    return {
      fires: true,
      relatedAccountId: null,
      body: `Your overall credit use is at ${pct}%. Lenders see this number — keeping it under 30% protects your credit score.`,
      data: { totalUtilization: total, cardCount },
      actionLabel: "See credit use",
      actionTarget: "/app/credit",
    };
  },
};
