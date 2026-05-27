"use client";

import { useState } from "react";
import { Flame } from "lucide-react";

interface StreakBadgeProps {
  streak: number;
  /** ISO dates (YYYY-MM-DD) the user checked in on, last ~35 days */
  checkinDates: string[];
}

const DAYS_BACK = 35; // 5 weeks

/**
 * Streak indicator under the net worth number. Tap to expand a compact
 * 5-week dot calendar of the days you checked in. Uses a flame icon
 * (not emoji) to stay on the premium side of the line.
 */
export function StreakBadge({ streak, checkinDates }: StreakBadgeProps) {
  const [open, setOpen] = useState(false);
  const checkedSet = new Set(checkinDates);

  // Build the last 35 calendar days (oldest first) for the grid
  const today = new Date();
  const cells: { iso: string; checked: boolean }[] = [];
  for (let i = DAYS_BACK - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    cells.push({ iso, checked: checkedSet.has(iso) });
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs"
        aria-expanded={open}
      >
        {streak > 0 ? (
          <>
            <Flame className="h-3.5 w-3.5 text-accent-primary" />
            <span className="font-medium text-positive">
              {streak} day streak
            </span>
          </>
        ) : (
          <span className="text-text-muted">Day 1 of vigilance</span>
        )}
      </button>

      {open && (
        <div className="mt-3 rounded-card border border-text-primary/8 bg-bg-tertiary p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Last 5 weeks
          </div>
          <div className="grid grid-flow-col grid-rows-7 gap-1">
            {cells.map((c) => (
              <span
                key={c.iso}
                title={c.iso}
                className={`h-3 w-3 rounded-[3px] ${
                  c.checked
                    ? "bg-accent-primary"
                    : "bg-text-primary/8"
                }`}
              />
            ))}
          </div>
          <div className="mt-2 text-[10px] text-text-muted">
            Each square is a day. Filled means you checked in.
          </div>
        </div>
      )}
    </div>
  );
}
