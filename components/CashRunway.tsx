"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Timer, TrendingUp } from "lucide-react";

import { formatBalance, type Currency } from "@/lib/money";
import type { RunwaySummary } from "@/lib/runway";

interface CashRunwayProps {
  summary: RunwaySummary;
  homeCurrency: Currency;
  scopeLabel?: string; // e.g. "Revarity" or undefined for "everything"
}

/**
 * Operator-only cash runway widget on /app home. Collapsed header shows
 * the headline (X days or "Sustainable"); expand to see the 30-day money
 * in / out breakdown. Renders nothing when there's no cash AND no IOU
 * activity at all — keeps the home clean before there's data to show.
 */
export function CashRunway({
  summary,
  homeCurrency,
  scopeLabel,
}: CashRunwayProps) {
  const [open, setOpen] = useState(false);

  if (
    summary.currentCash === 0 &&
    summary.incoming30 === 0 &&
    summary.outgoing30 === 0
  ) {
    return null;
  }

  const headline = summary.isSustainable
    ? "Sustainable"
    : `${summary.runwayDays} day${summary.runwayDays === 1 ? "" : "s"} of runway`;
  const sub = summary.isSustainable
    ? "More coming in than going out this month."
    : `On day 30 you'll have around ${formatBalance(
        Math.max(0, summary.projectedCashIn30),
        homeCurrency,
        { roundWholeAbove1000: true }
      )} at this pace.`;

  const Icon = summary.isSustainable ? TrendingUp : Timer;
  const accentClass = summary.isSustainable
    ? "bg-positive/10 text-positive"
    : (summary.runwayDays ?? 0) < 30
      ? "bg-negative/10 text-negative"
      : "bg-accent-soft text-accent-primary";

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
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${accentClass}`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text-primary">
              {headline}
              {scopeLabel && (
                <span className="ml-1 text-text-muted">· {scopeLabel}</span>
              )}
            </div>
            <div className="truncate text-[11px] text-text-secondary">
              {sub}
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
        <dl className="mt-2 overflow-hidden rounded-card border border-text-primary/8 bg-bg-tertiary divide-y divide-text-primary/6">
          <Row
            label="Cash on hand"
            value={formatBalance(summary.currentCash, homeCurrency, {
              roundWholeAbove1000: true,
            })}
          />
          <Row
            label="Coming in (next 30 days)"
            value={formatBalance(summary.incoming30, homeCurrency, {
              roundWholeAbove1000: true,
            })}
            tone="positive"
          />
          <Row
            label="Going out (next 30 days)"
            value={formatBalance(summary.outgoing30, homeCurrency, {
              roundWholeAbove1000: true,
            })}
            tone="negative"
          />
          <Row
            label="Net this month"
            value={`${summary.monthlyNet >= 0 ? "+" : "−"}${formatBalance(Math.abs(summary.monthlyNet), homeCurrency, { roundWholeAbove1000: true })}`}
            tone={summary.monthlyNet >= 0 ? "positive" : "negative"}
            bold
          />
        </dl>
      )}

      {open && (
        <p className="mt-2 px-4 text-[10px] leading-relaxed text-text-muted">
          Estimated from cash + active IOUs + credit-card minimums. A real
          spend-rate signal lands when our bank-data partner turns on the
          recurring-charge feed.
        </p>
      )}
    </section>
  );
}

function Row({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between px-4 py-3">
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd
        className={`tabular-nums ${bold ? "text-base font-semibold" : "text-sm font-medium"} ${
          tone === "positive"
            ? "text-positive"
            : tone === "negative"
              ? "text-negative"
              : "text-text-primary"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
