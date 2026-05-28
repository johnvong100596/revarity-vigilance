import { formatBalance, type Currency } from "@/lib/money";
import type { HintEvaluator } from "./types";

/**
 * H-304: subscription waste — total monthly recurring charges as a % of
 * the average operating-account balance.
 *
 * STATUS: NOT REGISTERED YET. Plaid Recurring Transactions hasn't been
 * granted at the account level (tracked in BLOCKERS-VIGILANCE-V11). When
 * the grant lands:
 *   1. Wire a `recurring_charges` table or pull live via the engine.
 *   2. Replace the eval body below with real numbers (drop the early
 *      false return).
 *   3. Register in lib/hints/registry.ts.
 *   4. Replace the preview UI in /app/subscriptions with a real list.
 *
 * Until then this evaluator is inert — keeping it here so the prompt /
 * shape / copy is reviewed and ready, not buried in a future ticket.
 */
export const H304: HintEvaluator = {
  id: "H-304",
  templateId: "H-304-subscription-burn",
  severity: "opportunity",
  title: "Subscription spend",
  eval(ctx) {
    // Read once the data feed lands. Until then: do not fire.
    void ctx;
    void formatBalance;
    void ({} as Currency);
    return { fires: false };
  },
};
