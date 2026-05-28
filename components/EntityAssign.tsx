"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { tagAccountWithEntity } from "@/lib/actions/operator";
import type { Entity } from "@/lib/types";

interface EntityAssignProps {
  accountId: string;
  currentEntityId: string | null;
  entities: Entity[];
}

/**
 * Compact "Assigned to" selector on the account detail page (operator-only,
 * gated by the parent). Saves on change. No save button — quiet polish.
 */
export function EntityAssign({
  accountId,
  currentEntityId,
  entities,
}: EntityAssignProps) {
  const router = useRouter();
  const [value, setValue] = useState<string>(currentEntityId ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(next: string) {
    setValue(next);
    setError(null);
    startTransition(async () => {
      try {
        await tagAccountWithEntity({
          accountId,
          entityId: next === "" ? null : next,
        });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
        setValue(currentEntityId ?? "");
      }
    });
  }

  const selected = entities.find((e) => e.id === currentEntityId) ?? null;

  return (
    <div className="rounded-card border border-text-primary/8 bg-bg-tertiary px-4 py-3">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        Assigned to
        {selected && (
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: selected.color_hex }}
          />
        )}
      </div>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={pending}
        className="flex h-10 w-full rounded-md border border-text-primary/12 bg-bg-primary px-3 text-sm text-text-primary focus:border-accent-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-primary/15 disabled:opacity-50"
      >
        <option value="">Not assigned</option>
        {entities.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1.5 text-xs text-negative">{error}</p>
      )}
    </div>
  );
}
