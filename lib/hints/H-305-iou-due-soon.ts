import { formatBalance, type Currency } from "@/lib/money";
import type { HintEvaluator } from "./types";

/**
 * H-305 (operator-tier): any "i_owe" IOU is due within the next 7 days
 * AND not yet settled. Fires on the soonest one.
 */

const DUE_SOON_DAYS = 7;
const MS_PER_DAY = 86400000;

export const H305: HintEvaluator = {
  id: "H-305",
  templateId: "H-305-iou-due-soon",
  severity: "pay_attention",
  title: "IOU due soon",
  eval(ctx) {
    const ious = ctx.ious ?? [];
    if (ious.length === 0) return { fires: false };

    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const soon = ious
      .filter(
        (i) =>
          i.direction === "i_owe" &&
          i.status === "active" &&
          i.due_date != null
      )
      .map((i) => {
        const due = new Date((i.due_date as string) + "T00:00:00");
        const daysUntil = Math.round((due.getTime() - now) / MS_PER_DAY);
        return { iou: i, daysUntil, due };
      })
      .filter((x) => x.daysUntil >= 0 && x.daysUntil <= DUE_SOON_DAYS)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    const best = soon[0];
    if (!best) return { fires: false };

    const whenLabel =
      best.daysUntil === 0
        ? "today"
        : best.daysUntil === 1
          ? "tomorrow"
          : best.due.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });

    return {
      fires: true,
      relatedAccountId: null,
      body: `You owe ${best.iou.counterparty_name} ${formatBalance(Number(best.iou.amount), best.iou.currency as Currency, { roundWholeAbove1000: true })} ${whenLabel}.`,
      data: { iouId: best.iou.id, daysUntil: best.daysUntil },
      actionLabel: "Open IOUs",
      actionTarget: "/app/ious",
    };
  },
};
