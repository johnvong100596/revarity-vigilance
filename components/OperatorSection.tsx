"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  createEntity,
  deleteEntity,
  setOperator,
  updateEntity,
} from "@/lib/actions/operator";
import type { Entity } from "@/lib/types";

const COLOR_CHOICES = [
  "#1A1A1A", // ink (Personal default)
  "#F04E37", // signal red
  "#0E7C5C", // forest
  "#2257B8", // blue
  "#B8A22A", // mustard
  "#7A3FBF", // purple
  "#C0392B", // crimson
  "#0E8A8A", // teal
];

interface OperatorSectionProps {
  isOperator: boolean;
  entities: Entity[];
}

export function OperatorSection({
  isOperator,
  entities,
}: OperatorSectionProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggle(next: boolean) {
    startTransition(async () => {
      try {
        await setOperator({ value: next });
        router.refresh();
      } catch (e) {
        console.error(e);
      }
    });
  }

  return (
    <section className="mb-10">
      <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        Operator mode
      </div>

      <div className="rounded-card border border-text-primary/8 bg-bg-tertiary">
        <label className="flex items-start justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-text-primary">
              I run businesses
            </div>
            <div className="mt-0.5 text-xs leading-relaxed text-text-secondary">
              Turn on extra features for people who manage multiple businesses
              or complex finances — tagging accounts by business, an IOU
              ledger, cash runway, and money flow between your businesses.
            </div>
          </div>
          <Toggle on={isOperator} disabled={pending} onChange={handleToggle} />
        </label>
      </div>

      {isOperator && (
        <EntityManager entities={entities} />
      )}
    </section>
  );
}

function Toggle({
  on,
  disabled,
  onChange,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition disabled:opacity-50 ${
        on ? "bg-accent-primary" : "bg-text-primary/15"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
          on ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

/* ── Entity manager ─────────────────────────────────────────────── */

function EntityManager({ entities }: { entities: Entity[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Your businesses
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent-primary underline-offset-4 hover:underline"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {entities.map((e) => (
          <li key={e.id}>
            {editingId === e.id ? (
              <EntityForm
                initial={e}
                onCancel={() => setEditingId(null)}
                onSaved={() => setEditingId(null)}
              />
            ) : (
              <EntityRow
                entity={e}
                onEdit={() => setEditingId(e.id)}
              />
            )}
          </li>
        ))}
      </ul>

      {adding && (
        <div className="mt-3">
          <EntityForm
            onCancel={() => setAdding(false)}
            onSaved={() => setAdding(false)}
          />
        </div>
      )}
    </div>
  );
}

function EntityRow({
  entity,
  onEdit,
}: {
  entity: Entity;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (
      !confirm(
        `Remove ${entity.name}? Its tagged accounts will become untagged.`
      )
    )
      return;
    startTransition(async () => {
      try {
        await deleteEntity({ id: entity.id });
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  return (
    <div className="flex items-center justify-between rounded-row border border-text-primary/8 bg-bg-tertiary px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className="h-5 w-5 shrink-0 rounded"
          style={{ backgroundColor: entity.color_hex }}
        />
        <span className="truncate text-sm font-medium text-text-primary">
          {entity.name}
        </span>
        {entity.is_personal && (
          <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
            Default
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {!entity.is_personal && (
          <>
            <button
              type="button"
              onClick={onEdit}
              disabled={pending}
              className="rounded-full p-1.5 text-text-secondary transition hover:bg-bg-secondary hover:text-text-primary disabled:opacity-50"
              aria-label="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="rounded-full p-1.5 text-text-secondary transition hover:bg-negative/10 hover:text-negative disabled:opacity-50"
              aria-label="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        {entity.is_personal && (
          <span className="px-2 text-[10px] text-text-muted">
            Can&apos;t remove
          </span>
        )}
      </div>
    </div>
  );
}

function EntityForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: Entity;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color_hex ?? COLOR_CHOICES[1]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initial);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        if (isEdit && initial) {
          await updateEntity({ id: initial.id, name, color_hex: color });
        } else {
          await createEntity({ name, color_hex: color });
        }
        router.refresh();
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-card border border-text-primary/12 bg-bg-tertiary p-3"
    >
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(ev) => setName(ev.target.value)}
        placeholder="Business name (e.g. Revarity, Serenity)"
        maxLength={40}
        className="flex h-10 w-full rounded-md border border-text-primary/12 bg-bg-primary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-primary/15"
      />
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Color
        </div>
        <div className="flex flex-wrap gap-2">
          {COLOR_CHOICES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-md transition ${
                color === c ? "ring-2 ring-accent-primary ring-offset-2 ring-offset-bg-tertiary" : ""
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Pick color ${c}`}
            />
          ))}
        </div>
      </div>
      {error && (
        <p className="text-xs text-negative">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-full border border-text-primary/15 bg-bg-tertiary py-2 text-xs font-semibold text-text-primary transition hover:bg-bg-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="flex-1 rounded-full bg-accent-primary py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : isEdit ? "Save" : "Add"}
        </button>
      </div>
    </form>
  );
}
