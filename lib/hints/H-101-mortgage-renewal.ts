import { formatBalance, type Currency } from "@/lib/money";
import type { HintEvaluator } from "./types";

// v1 hardcoded — moves to a market-rate feed in Day 6+ once we wire
// the Ratehub.ca scrape (mentioned in THESIS.md §6 H-101).
const MARKET_BEST_RATE_PCT = 4.79; // 3-yr fixed CAD reference
const RATE_DELTA_THRESHOLD = 0.5; // 50 bps cheaper at market = fire
const MONTHS_WINDOW = 18; // renewal within 18 months = in scope

function monthsBetween(from: Date, to: Date): number {
  const diffMs = to.getTime() - from.getTime();
  return Math.max(0, Math.round(diffMs / (30 * 86400000)));
}

export const H101: HintEvaluator = {
  id: "H-101",
  templateId: "H-101-mortgage-renewal",
  severity: "opportunity",
  title: "Mortgage renewal window",
  eval(ctx) {
    const today = new Date();
    const windowEnd = new Date(today);
    windowEnd.setMonth(windowEnd.getMonth() + MONTHS_WINDOW);

    const mortgages = ctx.accounts.filter(
      (a) =>
        a.category === "debt" &&
        a.account_type === "loan" &&
        a.renewal_date != null &&
        a.apr != null
    );

    for (const m of mortgages) {
      const renewalDate = new Date(m.renewal_date as string);
      if (Number.isNaN(renewalDate.getTime())) continue;
      if (renewalDate > windowEnd) continue;
      const apr = Number(m.apr);
      if (apr <= MARKET_BEST_RATE_PCT + RATE_DELTA_THRESHOLD) continue;

      const monthsToRenewal = monthsBetween(today, renewalDate);
      const principal = Number(m.balance);
      const annualSavings =
        principal * ((apr - MARKET_BEST_RATE_PCT) / 100);
      const currency = m.currency as Currency;

      return {
        fires: true,
        relatedAccountId: m.id,
        body: `Your ${m.name} renews in ${monthsToRenewal} month${monthsToRenewal === 1 ? "" : "s"} at ${apr.toFixed(2)}% a year. Big banks are quoting around ${MARKET_BEST_RATE_PCT}% on a 3-year. Start shopping now — could save roughly ${formatBalance(annualSavings, currency)} a year at renewal.`,
        data: {
          currentApr: apr,
          marketRate: MARKET_BEST_RATE_PCT,
          monthsToRenewal,
          principal,
          annualSavings,
          currency: m.currency,
        },
        actionLabel: "Compare rates",
        actionTarget: null,
      };
    }
    return { fires: false };
  },
};
