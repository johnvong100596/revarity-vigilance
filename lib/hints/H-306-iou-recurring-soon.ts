import { formatBalance, type Currency } from "@/lib/money";
import type { HintEvaluator } from "./types";

/**
 * H-306 (operator-tier): any recurring monthly "i_owe" IOU has its next
 * monthly payment landing within 3 days. Different from H-305 (which
 * uses the explicit due_date) — this is for ongoing obligations like
 * "$2K to Mom on the 15th of every month."
 */

const SOON_DAYS = 3;
const MS_PER_DAY = 86400000;

function nextOccurrenceOfDay(from: Date, day: number): Date {
  const y = from.getFullYear();
  const m = from.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const clamped = Math.min(day, daysInMonth);
  let target = new Date(y, m, clamped);
  target.setHours(0, 0, 0, 0);
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  if (target.getTime() < start.getTime()) {
    const nextDays = new Date(y, m + 2, 0).getDate();
    target = new Date(y, m + 1, Math.min(day, nextDays));
    target.setHours(0, 0, 0, 0);
  }
  return target;
}

export const H306: HintEvaluator = {
  id: "H-306",
  templateId: "H-306-iou-recurring-soon",
  severity: "pay_attention",
  title: "Recurring IOU payment coming up",
  eval(ctx) {
    const ious = ctx.ious ?? [];
    if (ious.length === 0) return { fires: false };

    const now = new Date();
    const candidates = ious
      .filter(
        (i) =>
          i.direction === "i_owe" &&
          i.status === "active" &&
          i.recurring != null &&
          i.recurring.frequency === "monthly"
      )
      .map((i) => {
        const day = Number(i.recurring!.day_of_month);
        const next = nextOccurrenceOfDay(now, day);
        const daysUntil = Math.round(
          (next.getTime() - now.getTime()) / MS_PER_DAY
        );
        return { iou: i, daysUntil, next };
      })
      .filter((x) => x.daysUntil >= 0 && x.daysUntil <= SOON_DAYS)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    const best = candidates[0];
    if (!best) return { fires: false };

    const whenLabel =
      best.daysUntil === 0
        ? "today"
        : best.daysUntil === 1
          ? "tomorrow"
          : `in ${best.daysUntil} days`;

    return {
      fires: true,
      relatedAccountId: null,
      body: `Your monthly ${formatBalance(Number(best.iou.amount), best.iou.currency as Currency, { roundWholeAbove1000: true })} payment to ${best.iou.counterparty_name} is due ${whenLabel}.`,
      data: { iouId: best.iou.id, daysUntil: best.daysUntil },
      actionLabel: "Open IOUs",
      actionTarget: "/app/ious",
    };
  },
};
