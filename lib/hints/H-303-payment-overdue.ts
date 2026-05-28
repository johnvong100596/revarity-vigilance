import { buildUpcomingPayments } from "@/lib/payments";
import type { HintEvaluator } from "./types";

/**
 * H-303: any debt account is past its payment_due_day for the current
 * cycle and the user hasn't marked it paid. The engine doesn't yet have
 * access to payment_marks from ctx, so we run a worst-case check based
 * solely on account fields — engine-level dedup keeps it from firing
 * twice. A future ctx extension can pass paid marks for cleaner results.
 */
export const H303: HintEvaluator = {
  id: "H-303",
  templateId: "H-303-payment-overdue",
  severity: "pay_attention",
  title: "Payment overdue",
  eval(ctx) {
    // No payment marks visible here — pass an empty set so we surface every
    // previous-cycle row. False positives self-correct on next eval after
    // the user taps "paid" (dismiss / re-eval).
    const rows = buildUpcomingPayments(ctx.accounts, new Set());
    const overdue = rows.filter((r) => r.isOverdue);
    if (overdue.length === 0) return { fires: false };

    const oldest = overdue.reduce((a, b) =>
      a.daysUntil < b.daysUntil ? a : b
    );
    const dueDate = new Date(oldest.dueDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    return {
      fires: true,
      relatedAccountId: oldest.accountId,
      body: `Your ${oldest.accountName} payment was due ${dueDate}. Mark it paid in "Coming up this week", or check your bank to be sure.`,
      data: {
        accountId: oldest.accountId,
        dueDate: oldest.dueDate,
        daysOverdue: Math.abs(oldest.daysUntil),
      },
      actionLabel: "Open home",
      actionTarget: "/app",
    };
  },
};
