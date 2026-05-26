"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  disconnectPlaidItem,
  restoreAccount,
  toggleProfileFlag,
} from "@/lib/actions/settings";
import { createClient } from "@/lib/supabase/client";

/* ── Toggle row (instant save) ───────────────────────────────── */

interface ToggleRowProps {
  label: string;
  description?: string;
  field: "expert_hints_enabled" | "decay_warnings_enabled";
  initial: boolean;
}

export function ToggleRow({ label, description, field, initial }: ToggleRowProps) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const next = !value;
    setValue(next);
    startTransition(async () => {
      try {
        await toggleProfileFlag({ field, value: next });
      } catch (err) {
        console.error(err);
        setValue(!next); // revert on failure
      }
    });
  }

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1">
        <div className="text-sm font-medium text-text-primary">{label}</div>
        {description && (
          <div className="mt-0.5 text-xs leading-relaxed text-text-secondary">
            {description}
          </div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={handleClick}
        disabled={pending}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          value ? "bg-accent-primary" : "bg-text-primary/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

/* ── Plaid item card with sync + disconnect ──────────────────── */

interface PlaidItemCardProps {
  id: string;
  institution: string;
  lastSyncAt: string | null;
  status: string;
}

export function PlaidItemCard({
  id,
  institution,
  lastSyncAt,
  status,
}: PlaidItemCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(
    lastSyncAt ? new Date(lastSyncAt) : null
  );

  function handleSync() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/plaid/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plaid_item_row_id: id }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `sync failed: ${res.status}`);
        }
        setSyncedAt(new Date());
        router.refresh();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Sync failed");
      }
    });
  }

  function handleDisconnect() {
    if (
      !confirm(
        `Disconnect ${institution}? Linked accounts will be archived but you can reconnect later.`
      )
    )
      return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await disconnectPlaidItem({ plaidItemRowId: id });
        router.refresh();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Disconnect failed");
      }
    });
  }

  const disabled = status !== "active";

  return (
    <div className="rounded-card border border-text-primary/8 bg-bg-tertiary p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-text-primary">
            {institution}
          </div>
          <div className="mt-0.5 text-xs text-text-secondary">
            {syncedAt
              ? `Last synced ${syncedAt.toLocaleString()}`
              : "Never synced"}
            {status !== "active" && (
              <span className="ml-2 rounded-full bg-negative/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-negative">
                {status}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleSync}
          disabled={pending || disabled}
          className="flex-1 rounded-full border border-text-primary/15 bg-bg-tertiary py-2 text-xs font-semibold text-text-primary transition hover:bg-bg-secondary disabled:opacity-50"
        >
          {pending ? "Working…" : "Sync now"}
        </button>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={pending}
          className="flex-1 rounded-full border border-negative/30 bg-bg-tertiary py-2 text-xs font-semibold text-negative transition hover:bg-negative/5 disabled:opacity-50"
        >
          Disconnect
        </button>
      </div>
      {errorMsg && (
        <p className="mt-2 text-center text-[11px] text-negative">{errorMsg}</p>
      )}
    </div>
  );
}

/* ── Archived account row with restore ───────────────────────── */

interface ArchivedAccountRowProps {
  id: string;
  name: string;
  subtitle: string | null;
}

export function ArchivedAccountRow({
  id,
  name,
  subtitle,
}: ArchivedAccountRowProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleRestore() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await restoreAccount({ accountId: id });
        router.refresh();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Restore failed");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex-1">
        <div className="text-sm font-medium text-text-primary">{name}</div>
        {subtitle && (
          <div className="text-xs text-text-secondary">{subtitle}</div>
        )}
        {errorMsg && (
          <p className="mt-1 text-[11px] text-negative">{errorMsg}</p>
        )}
      </div>
      <button
        type="button"
        onClick={handleRestore}
        disabled={pending}
        className="rounded-full border border-text-primary/15 bg-bg-tertiary px-4 py-1.5 text-xs font-semibold text-text-primary transition hover:bg-bg-secondary disabled:opacity-50"
      >
        {pending ? "Restoring…" : "Restore"}
      </button>
    </div>
  );
}

/* ── Sign out (client-side supabase.auth.signOut) ────────────── */

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="w-full rounded-full border border-negative/30 bg-bg-tertiary py-3 text-sm font-semibold text-negative transition hover:bg-negative/5 disabled:opacity-50"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
