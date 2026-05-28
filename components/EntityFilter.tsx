"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import type { Entity } from "@/lib/types";

interface EntityFilterProps {
  entities: Entity[];
  /** Currently selected entity id, "untagged" for the no-entity bucket,
   *  or null for "All". */
  selected: string | null;
}

/**
 * Filter chips above the accounts list, visible to operators only. The
 * selection lives in the URL (?entity=<id>|untagged|all) so the server
 * page can scope net worth, projection, and accounts to that entity on
 * the next render. Default (no chip selected) is "All", which leaves the
 * page in its grandma-friendly combined view.
 */
export function EntityFilter({ entities, selected }: EntityFilterProps) {
  const pathname = usePathname();
  const params = useSearchParams();

  function hrefFor(value: string | null): string {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (value == null) next.delete("entity");
    else next.set("entity", value);
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const chips: { key: string; label: string; value: string | null; color?: string }[] = [
    { key: "all", label: "All", value: null },
    ...entities.map((e) => ({
      key: e.id,
      label: e.name,
      value: e.id,
      color: e.color_hex,
    })),
    { key: "untagged", label: "Untagged", value: "untagged" },
  ];

  return (
    <div className="mb-5 -mx-1 overflow-x-auto">
      <div className="flex gap-2 px-1 pb-1">
        {chips.map((c) => {
          const isOn = (selected ?? null) === c.value;
          return (
            <Link
              key={c.key}
              href={hrefFor(c.value)}
              scroll={false}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                isOn
                  ? "border-accent-primary bg-accent-primary text-white"
                  : "border-text-primary/10 bg-bg-tertiary text-text-secondary hover:border-accent-primary/30 hover:text-text-primary"
              }`}
            >
              {c.color && (
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: isOn ? "#FFFFFF" : c.color }}
                />
              )}
              {c.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
