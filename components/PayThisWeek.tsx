"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Clock } from "lucide-react";

import {
  markPaymentPaid,
  unmarkPaymentPaid,
} from "@/lib/actions/payments";
import { formatBalance, type Currency } from "@/lib/money";
import type { UpcomingPayment } from "@/lib/payments";

interface PayThisWeekProps {
  payments: UpcomingPayment[];
  homeCurrency: Currency;
}

/**
 * Home-screen "Coming up this week" widget (WS3). Collapsed by default
 * showing the total + count; tap to expand and mark items paid.
 */
export function PayThisWeek({ payments, homeCurrency }: PayThisWeekProps) {
  const [open, setOpen] = useState(false);

  if (payments.length === 0) return null;

  const visible = payments.filter((p) => !p.isPaid);
  const overdueCount = visible.filter((p) => p.isOverdue).length;
  const totalUnpaid = visible.reduce((s, p) => s + (p.amount || 0), 0);

  // When everything is marked paid for this window, hide the widget
  if (visible.length === 0) return null;

  return (
    <section className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-card border border-text-primary/8 bg-bg-tertiary p-4 text-left transition hover:shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              overdueCount > 0
                ? "bg-negative/10 text-negative"
                : "bg-accent-soft text-accent-primary"
            }`}
          >
            <Clock className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text-primary">
              {overdueCount > 0
                ? `${overdueCount} payment${overdueCount === 1 ? "" : "s"} overdue`
                : "Coming up this week"}
            </div>
            <div className="text-[11px] text-text-secondary">
              {totalUnpaid > 0
                ? `${formatBalance(totalUnpaid, homeCurrency, { roundWholeAbove1000: true })} across ${visible.length} payment${visible.length === 1 ? "" : "s"}`
                : `${visible.length} payment${visible.length === 1 ? "" : "s"} to acknowledge`}
            </div>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-text-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 text-text-muted" />
        )}
      </button>

      {open && (
        <ul className="mt-2 space-y-2">
          {payments.map((p) => (
            <PaymentRow
              key={`${p.accountId}:${p.dueDate}`}
              payment={p}
              homeCurrency={homeCurrency}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function formatDueLabel(p: UpcomingPayment): string {
  if (p.isOverdue) {
    const n = Math.abs(p.daysUntil);
    return n === 0 ? "Overdue today" : `Overdue by ${n} day${n === 1 ? "" : "s"}`;
  }
  if (p.daysUntil === 0) return "Due today";
  if (p.daysUntil === 1) return "Due tomorrow";
  return `Due in ${p.daysUntil} days`;
}

function PaymentRow({
  payment,
  homeCurrency,
}: {
  payment: UpcomingPayment;
  homeCurrency: Currency;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const currency = (payment.currency as Currency) || homeCurrency;

  function toggle() {
    startTransition(async () => {
      try {
        if (payment.isPaid) {
          await unmarkPaymentPaid({
            accountId: payment.accountId,
            dueDate: payment.dueDate,
          });
        } else {
          await markPaymentPaid({
            accountId: payment.accountId,
            dueDate: payment.dueDate,
          });
        }
        router.refresh();
      } catch (e) {
        console.error(e);
      }
    });
  }

  return (
    <li
      className={`flex items-center justify-between rounded-card border border-text-primary/8 bg-bg-tertiary px-4 py-3 ${
        payment.isPaid ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0">
        <div
          className={`truncate text-sm font-medium ${
            payment.isPaid
              ? "text-text-muted line-through"
              : "text-text-primary"
          }`}
        >
          {payment.accountName}
        </div>
        <div
          className={`mt-0.5 text-xs ${
            payment.isOverdue && !payment.isPaid
              ? "font-medium text-negative"
              : "text-text-secondary"
          }`}
        >
          {payment.isPaid
            ? "Marked paid"
            : formatDueLabel(payment)}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {payment.amount > 0 && (
          <span className="text-sm font-semibold tabular-nums text-text-primary">
            {formatBalance(payment.amount, currency, {
              roundWholeAbove1000: true,
            })}
          </span>
        )}
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-label={payment.isPaid ? "Undo paid" : "Mark paid"}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
            payment.isPaid
              ? "border-accent-primary bg-accent-primary text-white"
              : "border-text-primary/20 text-transparent hover:border-accent-primary/40"
          } disabled:opacity-50`}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </button>
      </div>
    </li>
  );
}
