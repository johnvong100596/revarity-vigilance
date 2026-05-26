"use client";

import { useState, useTransition } from "react";
import { Lock, Plus, X } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { lockMonthlyClose } from "@/lib/actions/rituals";
import { formatBalance, type Currency } from "@/lib/money";
import type { DailyPoint, WaterfallRow } from "@/lib/rituals";

interface WeeklyReflectionRow {
  weekStarting: string;
  text: string | null;
}

interface CloseClientProps {
  month: string;
  homeCurrency: Currency;
  netWorthStart: number | null;
  netWorthEnd: number | null;
  series: DailyPoint[];
  waterfall: WaterfallRow[];
  autoWins: string[];
  autoDrags: string[];
  weeklyReflections: WeeklyReflectionRow[];
  locked: {
    netWorth: number | null;
    monthlyChange: number | null;
    waterfall: WaterfallRow[];
    wins: string[];
    drags: string[];
    notes: string;
    lockedAt: string;
  } | null;
}

export function CloseClient({
  month,
  homeCurrency,
  netWorthStart,
  netWorthEnd,
  series,
  waterfall,
  autoWins,
  autoDrags,
  weeklyReflections,
  locked,
}: CloseClientProps) {
  const isLocked = locked != null;
  const change =
    netWorthStart != null && netWorthEnd != null
      ? netWorthEnd - netWorthStart
      : null;

  const [wins, setWins] = useState<string[]>(locked?.wins ?? autoWins);
  const [drags, setDrags] = useState<string[]>(locked?.drags ?? autoDrags);
  const [notes, setNotes] = useState<string>(locked?.notes ?? "");
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleLock() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await lockMonthlyClose({
          month,
          netWorth: netWorthEnd,
          monthlyChange: change,
          waterfallBreakdown: waterfall,
          wins,
          drags,
          notes: notes.trim(),
        });
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Lock failed");
      }
    });
  }

  const displayWaterfall = locked?.waterfall ?? waterfall;
  const chartData = series.map((p) => ({
    date: p.date.getTime(),
    netWorth: p.netWorth,
    label: p.date.getDate(),
  }));
  const hasChartData = series.some((p) => p.netWorth != null);

  return (
    <>
      {/* Headline */}
      <section className="mb-8 rounded-card border border-text-primary/8 bg-bg-tertiary p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Net worth this month
        </div>
        {change != null ? (
          <>
            <div
              className={`mt-2 text-[40px] font-bold leading-none tracking-[-0.025em] tabular-nums ${
                change >= 0 ? "text-positive" : "text-negative"
              }`}
            >
              {change >= 0 ? "+" : "−"}
              {formatBalance(Math.abs(change), homeCurrency)}
            </div>
            {netWorthStart != null && netWorthEnd != null && (
              <div className="mt-2 text-xs text-text-secondary">
                {formatBalance(netWorthStart, homeCurrency)} →{" "}
                {formatBalance(netWorthEnd, homeCurrency)}
              </div>
            )}
          </>
        ) : (
          <div className="mt-2 text-sm text-text-secondary">
            Not enough data yet to measure month-over-month change.
          </div>
        )}
        {isLocked && (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-positive/10 px-3 py-1 text-[11px] font-semibold text-positive">
            <Lock className="h-3 w-3" />
            Locked
          </div>
        )}
      </section>

      {/* Month chart */}
      <section className="mb-8">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Month trajectory
        </div>
        {!hasChartData ? (
          <div className="flex h-[200px] items-center justify-center rounded-card border border-dashed border-text-primary/15 bg-bg-tertiary text-xs text-text-secondary">
            More data after more check-ins.
          </div>
        ) : (
          <div className="h-[220px] w-full rounded-card border border-text-primary/8 bg-bg-tertiary p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <defs>
                  <linearGradient id="fill-month" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F04E37" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#F04E37" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#8C8C8C" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="netWorth"
                  tickFormatter={(v) =>
                    Number(v) >= 1000
                      ? `${(Number(v) / 1000).toFixed(0)}k`
                      : String(v)
                  }
                  tick={{ fontSize: 10, fill: "#8C8C8C" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid rgba(26,26,26,0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v) =>
                    v == null
                      ? ["—", "Net worth"]
                      : [formatBalance(Number(v), homeCurrency), "Net worth"]
                  }
                />
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  stroke="#F04E37"
                  strokeWidth={2}
                  fill="url(#fill-month)"
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Waterfall */}
      <section className="mb-8">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Where money moved
        </div>
        {displayWaterfall.length === 0 ? (
          <div className="rounded-card border border-text-primary/8 bg-bg-tertiary px-4 py-3 text-xs text-text-secondary">
            Nothing meaningful moved across asset categories this month.
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-text-primary/8 bg-bg-tertiary">
            <Waterfall rows={displayWaterfall} currency={homeCurrency} />
          </div>
        )}
      </section>

      {/* Wins + Drags */}
      <section className="mb-8 grid gap-4 md:grid-cols-2">
        <EditableList
          label="Wins"
          color="text-positive"
          items={wins}
          onChange={setWins}
          placeholder="Paid down Visa $1,840"
          readOnly={isLocked}
        />
        <EditableList
          label="Drags"
          color="text-negative"
          items={drags}
          onChange={setDrags}
          placeholder="Crypto down 12%"
          readOnly={isLocked}
        />
      </section>

      {/* Weekly reflections roundup */}
      {weeklyReflections.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Weekly reflections this month
          </div>
          <ul className="space-y-3">
            {weeklyReflections.map((w) => (
              <li
                key={w.weekStarting}
                className="rounded-card border border-text-primary/8 bg-bg-tertiary p-4"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  Week of{" "}
                  {new Date(w.weekStarting).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div className="mt-2 text-sm leading-relaxed text-text-primary">
                  {w.text ?? (
                    <span className="text-text-muted">No reflection saved.</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Notes */}
      <section className="mb-6">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Notes for next month
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          readOnly={isLocked}
          rows={5}
          placeholder="One paragraph. What did this month teach you?"
          className="w-full resize-none rounded-card border border-text-primary/12 bg-bg-tertiary p-4 text-[15px] leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-primary/15 disabled:opacity-70"
        />
      </section>

      {/* Lock button */}
      {!isLocked && (
        <section className="mb-6">
          <button
            type="button"
            onClick={handleLock}
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent-primary py-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <Lock className="h-4 w-4" />
            {pending ? "Locking…" : "Lock the month"}
          </button>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-text-muted">
            Once locked, this month becomes a permanent snapshot. You can&apos;t
            edit it after.
          </p>
        </section>
      )}

      {errorMsg && (
        <p className="text-center text-sm text-negative">{errorMsg}</p>
      )}

      {isLocked && locked?.lockedAt && (
        <p className="text-center text-[11px] text-text-muted">
          Locked {new Date(locked.lockedAt).toLocaleDateString()}
        </p>
      )}
    </>
  );
}

function Waterfall({
  rows,
  currency,
}: {
  rows: WaterfallRow[];
  currency: Currency;
}) {
  const max = Math.max(...rows.map((r) => Math.abs(r.delta)), 1);
  return (
    <ul>
      {rows.map((r, i) => {
        const pct = (Math.abs(r.delta) / max) * 100;
        const positive = r.delta >= 0;
        return (
          <li
            key={r.bucket}
            className={`px-4 py-3 ${i < rows.length - 1 ? "border-b border-text-primary/6" : ""}`}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <div className="text-sm font-medium text-text-primary">
                {r.label}
              </div>
              <div
                className={`text-sm font-semibold tabular-nums ${positive ? "text-positive" : "text-negative"}`}
              >
                {positive ? "+" : "−"}
                {formatBalance(Math.abs(r.delta), currency)}
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-secondary">
              <div
                className={`h-full rounded-full ${positive ? "bg-positive" : "bg-negative"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function EditableList({
  label,
  color,
  items,
  onChange,
  placeholder,
  readOnly,
}: {
  label: string;
  color: string;
  items: string[];
  onChange: (n: string[]) => void;
  placeholder: string;
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="rounded-card border border-text-primary/8 bg-bg-tertiary p-4">
      <div
        className={`mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] ${color}`}
      >
        {label}
      </div>
      {items.length === 0 && readOnly && (
        <div className="text-xs text-text-muted">None recorded.</div>
      )}
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex items-start justify-between gap-2 rounded-md bg-bg-primary px-3 py-2 text-sm text-text-primary"
          >
            <span className="flex-1 leading-snug">{it}</span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                aria-label={`Remove ${it}`}
                className="-m-1 p-1 text-text-muted transition hover:text-negative"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = draft.trim();
            if (!v) return;
            onChange([...items, v]);
            setDraft("");
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded-md border border-text-primary/12 bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-primary/15"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="inline-flex items-center gap-1 rounded-md border border-text-primary/15 px-2 text-xs font-semibold text-text-primary transition hover:bg-bg-secondary disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </form>
      )}
    </div>
  );
}
