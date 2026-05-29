import { calculateRunway } from "@/lib/runway";
import type { HintEvaluator } from "./types";

/**
 * H-307 (operator-tier): cash runway is under 30 days at the current
 * burn. Fires once per workspace; the engine's dedup keeps it from
 * re-asserting if the runway hasn't moved.
 */

const LOW_RUNWAY_DAYS = 30;

export const H307: HintEvaluator = {
  id: "H-307",
  templateId: "H-307-low-runway",
  severity: "pay_attention",
  title: "Cash runway is short",
  eval(ctx) {
    if (!ctx.profile.is_operator) return { fires: false };
    if ((ctx.ious ?? []).length === 0 && ctx.accounts.length === 0) {
      return { fires: false };
    }
    const summary = calculateRunway({
      accounts: ctx.accounts,
      ious: ctx.ious ?? [],
    });
    if (summary.isSustainable) return { fires: false };
    if (summary.runwayDays == null) return { fires: false };
    if (summary.runwayDays >= LOW_RUNWAY_DAYS) return { fires: false };

    return {
      fires: true,
      relatedAccountId: null,
      body: `Your cash runway is ${summary.runwayDays} day${summary.runwayDays === 1 ? "" : "s"} at this pace. To stretch it: cut a recurring bill, collect money someone owes you, or borrow from a line of credit before things get tight.`,
      data: { runwayDays: summary.runwayDays },
      actionLabel: "See breakdown",
      actionTarget: "/app",
    };
  },
};
