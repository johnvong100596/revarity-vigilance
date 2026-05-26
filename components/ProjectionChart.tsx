"use client";

import { useState, useMemo } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatBalance, type Currency } from "@/lib/money";
import { projectNetWorth, type ProjectionPoint } from "@/lib/projection";
import type { Account } from "@/lib/types";
import type { RawSnapshot } from "@/lib/rituals";

interface ProjectionChartProps {
  accounts: Account[];
  snapshots: RawSnapshot[];
  homeCurrency: Currency;
}

const HORIZONS: { label: string; years: number }[] = [
  { label: "1y", years: 1 },
  { label: "3y", years: 3 },
  { label: "5y", years: 5 },
  { label: "10y", years: 10 },
];

export function ProjectionChart({
  accounts,
  snapshots,
  homeCurrency,
}: ProjectionChartProps) {
  const [horizon, setHorizon] = useState(3);
  const points: ProjectionPoint[] = useMemo(
    () => projectNetWorth(accounts, snapshots, horizon),
    [accounts, snapshots, horizon]
  );

  if (points.length === 0) {
    return null;
  }

  const finalValue = points[points.length - 1]?.projected ?? 0;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Where you&apos;re heading
          </div>
          <div className="mt-1 text-xs text-text-secondary">
            Projected in {HORIZONS.find((h) => h.years === horizon)?.label} based
            on your trajectory and active debt paydown
          </div>
        </div>
        <div className="flex gap-1 rounded-full border border-text-primary/8 bg-bg-tertiary p-0.5">
          {HORIZONS.map((h) => (
            <button
              key={h.years}
              type="button"
              onClick={() => setHorizon(h.years)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                horizon === h.years
                  ? "bg-accent-primary text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-card border border-text-primary/8 bg-bg-tertiary p-3">
        <div className="mb-3 px-1">
          <div className="text-2xl font-bold tracking-[-0.025em] tabular-nums text-text-primary">
            {formatBalance(finalValue, homeCurrency)}
          </div>
          <div className="text-[11px] text-text-muted">
            estimated net worth in {HORIZONS.find((h) => h.years === horizon)?.label}
          </div>
        </div>
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="fill-projection" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F04E37" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#F04E37" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                type="number"
                domain={["dataMin", "dataMax"]}
                scale="time"
                tickFormatter={(v) =>
                  new Date(v).toLocaleDateString("en-US", {
                    month: "short",
                    year: horizon >= 3 ? "2-digit" : undefined,
                  })
                }
                tick={{ fontSize: 10, fill: "#8C8C8C" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) =>
                  Number(v) >= 1_000_000
                    ? `${(Number(v) / 1_000_000).toFixed(1)}M`
                    : Number(v) >= 1000
                      ? `${(Number(v) / 1000).toFixed(0)}k`
                      : String(v)
                }
                tick={{ fontSize: 10, fill: "#8C8C8C" }}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid rgba(26,26,26,0.1)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(v) =>
                  new Date(Number(v)).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })
                }
                formatter={(v) => [
                  formatBalance(Number(v ?? 0), homeCurrency),
                  "Projected",
                ]}
              />
              <Area
                type="monotone"
                dataKey="projected"
                stroke="#F04E37"
                strokeWidth={2}
                strokeDasharray="4 4"
                fill="url(#fill-projection)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 px-1 text-[10px] leading-relaxed text-text-muted">
          Projection assumes your last 90 days&apos; trajectory continues + any
          debts paid at their minimum continue paying down. It does not model
          new income, market crashes, or windfalls. A guide, not a prediction.
        </p>
      </div>
    </section>
  );
}
