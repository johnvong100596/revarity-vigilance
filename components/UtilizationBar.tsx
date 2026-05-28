interface UtilizationBarProps {
  /** 0..1 — defensively clamped */
  fraction: number;
  className?: string;
}

/**
 * One-line credit-use bar. Color follows the 30%/70% breakpoints from
 * H-002/H-301/H-302 so the visual matches what the hints care about.
 */
export function UtilizationBar({ fraction, className }: UtilizationBarProps) {
  const f = Math.min(1, Math.max(0, fraction));
  const pct = f * 100;
  const color =
    f < 0.3
      ? "bg-positive"
      : f < 0.7
        ? "bg-decay-warning"
        : "bg-negative";

  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-text-primary/8 ${className ?? ""}`}
    >
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
