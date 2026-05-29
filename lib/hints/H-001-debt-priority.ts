import { isAprVerified } from "@/lib/apr";
import { formatBalance, type Currency } from "@/lib/money";
import type { HintEvaluator } from "./types";

// v1 assumption: until we have a settings page that lets the user override
// their long-run expected investment return, assume 6% as a reasonable
// market baseline (S&P real return after inflation is ~6.5%).
const ASSUMED_AVG_INVESTMENT_RETURN = 6.0;
// THESIS.md §6 fires the hint when debt APR exceeds 70% of the assumed
// return — debts above that threshold beat market returns risk-free.
const APR_THRESHOLD = ASSUMED_AVG_INVESTMENT_RETURN * 0.7;

export const H001: HintEvaluator = {
  id: "H-001",
  templateId: "H-001-debt-priority",
  severity: "pay_attention",
  title: "Your most expensive debt",
  eval(ctx) {
    // Only consider debts with a VERIFIED APR (M6) — firing on garbage
    // data like a 999% typo would undermine the hint's credibility.
    const debts = ctx.accounts.filter(
      (a) => a.category === "debt" && isAprVerified(a.apr, a)
    );
    if (debts.length === 0) return { fires: false };

    const worst = debts.reduce((max, d) =>
      Number(d.apr) > Number(max.apr) ? d : max
    );
    const apr = Number(worst.apr);
    if (apr <= APR_THRESHOLD) return { fires: false };

    const balanceStr = formatBalance(worst.balance, worst.currency as Currency);

    return {
      fires: true,
      relatedAccountId: worst.id,
      body: `Your ${worst.name} charges ${apr.toFixed(2)}% a year on a ${balanceStr} balance — your priciest debt. Paying it down is a guaranteed win: better than the ~${ASSUMED_AVG_INVESTMENT_RETURN}% a year you might make investing, with none of the risk. Clear this before putting more into investments.`,
      data: {
        apr,
        threshold: APR_THRESHOLD,
        balance: Number(worst.balance),
        currency: worst.currency,
      },
      actionLabel: "Plan payoff",
      actionTarget: `/app/accounts/${worst.id}`,
    };
  },
};
