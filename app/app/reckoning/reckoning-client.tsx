"use client";

import { useState, useTransition } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { saveWeeklyReflection } from "@/lib/actions/rituals";
import { formatBalance, type Currency } from "@/lib/money";
import type { DailyPoint, MoverRow } from "@/lib/rituals";

interface ReckoningClientProps {
  weekStarting: string;
  homeCurrency: Currency;
  netWorthStart: number | null;
  netWorthEnd: number | null;
  series: DailyPoint[];
  movers: MoverRow[];
  existingReflection: string | null;
}

export function ReckoningClient({
  weekStarting,
  homeCurrency,
  netWorthStart,
  netWorthEnd,
  series,
  movers,
  existingReflection,
}: ReckoningClientProps) {
  const [reflection, setReflection] = useState(existingReflection ?? "");
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(
    existingReflection ? new Date() : null
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleSave() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await saveWeeklyReflection({
          weekStarting,
          reflectionText: reflection.trim(),
          netWorthStart,
          netWorthEnd,
          biggestMovers: movers,
          paymentsSummary: [],
        });
        setSavedAt(new Date());
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  const change =
    netWorthStart != null && netWorthEnd != null
      ? netWorthEnd - netWorthStart
      : null;
  const chartData = series.map((p) => ({
    date: p.date.getTime(),
    netWorth: p.netWorth,
    label: p.date.toLocaleDateString("en-US", { weekday: "short" }),
  }));
  const hasChartData = series.some((p) => p.netWorth != null);

  return (
    <>
      {/* Headline change */}
      <section className="mb-8 rounded-card border border-text-primary/8 bg-bg-tertiary p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Net worth this week
        </div>
        {change != null ? (
          <>
            <div
              className={`mt-2 text-[36px] font-bold leading-none tracking-[-0.025em] tabular-nums ${
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
            Not enough check-ins yet to measure change. Keep showing up.
          </div>
        )}
      </section>

      {/* 7-day chart */}
      <section className="mb-8">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          7-day trajectory
        </div>
        {!hasChartData ? (
          <div className="flex h-[180px] items-center justify-center rounded-card border border-dashed border-text-primary/15 bg-bg-tertiary text-xs text-text-secondary">
            More data after more check-ins.
          </div>
        ) : (
          <div className="h-[200px] w-full rounded-card border border-text-primary/8 bg-bg-tertiary p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <defs>
                  <linearGradient id="fill-net-worth" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#fill-net-worth)"
                  dot={{ fill: "#F04E37", r: 3 }}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Biggest movers */}
      <section className="mb-8">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Biggest movers
        </div>
        {movers.length === 0 ? (
          <div className="rounded-card border border-text-primary/8 bg-bg-tertiary px-4 py-3 text-xs text-text-secondary">
            Quiet week. No account moved meaningfully.
          </div>
        ) : (
          <ul className="overflow-hidden rounded-card border border-text-primary/8 bg-bg-tertiary">
            {movers.map((m, i) => {
              const up = m.delta >= 0;
              return (
                <li
                  key={m.accountId}
                  className={`flex items-center justify-between px-4 py-3 ${i < movers.length - 1 ? "border-b border-text-primary/6" : ""}`}
                >
                  <div>
                    <div className="text-sm font-medium text-text-primary">
                      {m.name}
                    </div>
                    {m.subtitle && (
                      <div className="text-xs text-text-secondary">
                        {m.subtitle}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-semibold tabular-nums ${up !== m.isDebt ? "text-positive" : "text-negative"}`}
                    >
                      {m.delta >= 0 ? "+" : "−"}
                      {formatBalance(
                        Math.abs(m.delta),
                        m.currency as Currency
                      )}
                    </div>
                    {m.pct != null && (
                      <div className="text-[10px] tabular-nums text-text-muted">
                        {m.pct >= 0 ? "+" : ""}
                        {m.pct.toFixed(1)}%
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Reflection prompt */}
      <section className="mb-6">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Reflection
        </div>
        <div className="mb-3 text-base font-medium text-text-primary">
          What financial decision do you need to make this week?
        </div>
        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          rows={6}
          placeholder="One thing on your mind. Two sentences is enough."
          className="w-full resize-none rounded-card border border-text-primary/12 bg-bg-tertiary p-4 text-[15px] leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-primary/15"
        />
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-[11px] text-text-muted">
            {savedAt ? `Saved · ${savedAt.toLocaleTimeString()}` : "Not saved"}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || !reflection.trim()}
            className="rounded-full bg-accent-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : savedAt ? "Update" : "Save reflection"}
          </button>
        </div>
        {errorMsg && (
          <p className="mt-2 text-center text-xs text-negative">{errorMsg}</p>
        )}
      </section>
    </>
  );
}
