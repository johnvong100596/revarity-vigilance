import Link from "next/link";
import { Check } from "lucide-react";

interface GettingStartedItem {
  label: string;
  done: boolean;
  href?: string;
}

interface GettingStartedCardProps {
  items: GettingStartedItem[];
}

/**
 * First-week getting-started checklist (WS3 Task 3.3). Sits below net worth,
 * above the accounts list. The parent decides whether to render it at all
 * (hidden once 3 of 4 are done, or after 7 days). Quiet, not dominating —
 * a nudge, not a wizard.
 */
export function GettingStartedCard({ items }: GettingStartedCardProps) {
  const doneCount = items.filter((i) => i.done).length;

  return (
    <section className="mb-8 rounded-card border border-text-primary/8 bg-bg-tertiary p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Getting started
        </div>
        <div className="text-[11px] tabular-nums text-text-muted">
          {doneCount}/{items.length}
        </div>
      </div>
      <ul className="space-y-2">
        {items.map((item) => {
          const row = (
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  item.done
                    ? "border-accent-primary bg-accent-primary text-white"
                    : "border-text-primary/20 text-transparent"
                }`}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span
                className={`text-sm ${
                  item.done
                    ? "text-text-muted line-through"
                    : "text-text-primary"
                }`}
              >
                {item.label}
              </span>
            </div>
          );
          return (
            <li key={item.label}>
              {item.done || !item.href ? (
                row
              ) : (
                <Link
                  href={item.href}
                  className="block rounded-row transition hover:opacity-80"
                >
                  {row}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
