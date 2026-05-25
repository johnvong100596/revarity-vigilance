import type { HintEvaluator } from "./types";

// 60/40 stock/bond is the textbook diversification anchor. THESIS.md §6
// allows owner override later (capital_waterfall on profile); for v1 we
// use the default and surface when allocation drifts > 1.5x or < 0.5x
// of the target on either side.
const TARGET_RISK_PCT = 60;
const UPPER_BOUND = TARGET_RISK_PCT * 1.5; // 90% — too concentrated
const LOWER_BOUND = TARGET_RISK_PCT * 0.5; // 30% — too defensive

// Map account_type → "risk" (stocks/crypto) vs "cash" (bonds-equivalent
// since we don't yet track bond holdings explicitly). 'investment' covers
// brokerage equity / ETFs. 'loan' (debt) is excluded from the portfolio
// calc entirely.
function classify(accountType: string): "risk" | "cash" | "exclude" {
  if (accountType === "investment" || accountType === "crypto") return "risk";
  if (accountType === "bank" || accountType === "cash") return "cash";
  return "exclude";
}

export const H201: HintEvaluator = {
  id: "H-201",
  templateId: "H-201-portfolio-weighting",
  severity: "strategic",
  title: "Portfolio weighting",
  eval(ctx) {
    const assets = ctx.accounts.filter((a) => a.category === "asset");
    if (assets.length < 2) return { fires: false };

    let total = 0;
    let risk = 0;
    let cash = 0;
    for (const a of assets) {
      const cls = classify(a.account_type);
      const bal = Number(a.balance);
      if (cls === "exclude") continue;
      total += bal;
      if (cls === "risk") risk += bal;
      else cash += bal;
    }
    if (total === 0) return { fires: false };

    const riskPct = (risk / total) * 100;
    const cashPct = (cash / total) * 100;

    if (riskPct > UPPER_BOUND) {
      return {
        fires: true,
        relatedAccountId: null,
        body: `Risk assets (investments + crypto) are ${riskPct.toFixed(0)}% of your portfolio. The classic 60/40 stock/bond benchmark holds ${TARGET_RISK_PCT}%. You're concentrated — a single drawdown wipes more than you may want. Consider raising the cash/bond side.`,
        data: { riskPct, cashPct, target: TARGET_RISK_PCT, bound: "upper" },
        actionLabel: "Review allocation",
        actionTarget: "/app",
      };
    }
    if (riskPct < LOWER_BOUND) {
      return {
        fires: true,
        relatedAccountId: null,
        body: `Cash position is ${cashPct.toFixed(0)}% of your portfolio. The classic 60/40 benchmark holds 40% cash; you're over-reserving. That's drag on long-run returns. Consider deploying to risk assets.`,
        data: { riskPct, cashPct, target: TARGET_RISK_PCT, bound: "lower" },
        actionLabel: "Review allocation",
        actionTarget: "/app",
      };
    }

    return { fires: false };
  },
};
