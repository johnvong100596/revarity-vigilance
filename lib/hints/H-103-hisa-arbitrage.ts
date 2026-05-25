import { formatBalance, type Currency } from "@/lib/money";
import type { HintEvaluator } from "./types";

// v1 hardcoded benchmark — moves to settings later. EQ Bank Savings Plus
// HISA is ~4.25% (as of Q1 2026), Wealthsimple Cash 3.25%, etc. Pick a
// conservative round number for messaging.
const BENCHMARK_HISA_PCT = 4.5;
// Default rate we assume an unspecified chequing account is earning.
// (Most big-bank chequing accounts pay 0-0.5% — Vigilance doesn't track
// the actual interest rate yet, so use this for the savings-pitch math.)
const ASSUMED_CURRENT_PCT = 0.5;
// Threshold: only nag if there's enough cash for the rate diff to matter.
// $25K × (4.5% - 0.5%) ≈ $1,000/yr — worth a 5-minute transfer.
const CASH_THRESHOLD = 25000;

const ANNUAL_DIFF_FRACTION =
  (BENCHMARK_HISA_PCT - ASSUMED_CURRENT_PCT) / 100;

export const H103: HintEvaluator = {
  id: "H-103",
  templateId: "H-103-hisa-arbitrage",
  severity: "opportunity",
  title: "HISA arbitrage",
  eval(ctx) {
    const cashLike = ctx.accounts.filter(
      (a) =>
        a.category === "asset" &&
        (a.account_type === "bank" || a.account_type === "cash") &&
        Number(a.balance) > CASH_THRESHOLD
    );
    if (cashLike.length === 0) return { fires: false };

    const biggest = cashLike.reduce((max, c) =>
      Number(c.balance) > Number(max.balance) ? c : max
    );
    const balance = Number(biggest.balance);
    const annualGain = balance * ANNUAL_DIFF_FRACTION;
    const currency = biggest.currency as Currency;

    return {
      fires: true,
      relatedAccountId: biggest.id,
      body: `${formatBalance(balance, currency)} sitting in ${biggest.name}. Moving to a HISA at ~${BENCHMARK_HISA_PCT}% earns roughly ${formatBalance(annualGain, currency)}/yr extra vs a chequing rate. 5-minute transfer.`,
      data: {
        balance,
        benchmark: BENCHMARK_HISA_PCT,
        assumedCurrent: ASSUMED_CURRENT_PCT,
        annualGain,
        currency: biggest.currency,
      },
      actionLabel: "Compare HISAs",
      actionTarget: null,
    };
  },
};
