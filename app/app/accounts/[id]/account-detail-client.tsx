"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  archiveAccount,
  updateAccountBalance,
} from "@/lib/actions/accounts";
import { formatBalance, type Currency } from "@/lib/money";
import type { Account } from "@/lib/types";

export interface SnapshotPoint {
  capturedAt: string;
  balance: number;
}

interface AccountDetailClientProps {
  account: Account;
  snapshots: SnapshotPoint[];
}

export function AccountDetailClient({
  account,
  snapshots,
}: AccountDetailClientProps) {
  const router = useRouter();
  const currency = account.currency as Currency;
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const chartData = snapshots.map((s) => ({
    date: new Date(s.capturedAt).getTime(),
    balance: Number(s.balance),
  }));

  function submitEdit(newBalance: number) {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await updateAccountBalance({ accountId: account.id, newBalance });
        setEditing(false);
        router.refresh();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Update failed");
      }
    });
  }

  function submitArchive() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await archiveAccount({ accountId: account.id });
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Archive failed");
      }
    });
  }

  return (
    <>
      {/* Balance display + edit */}
      <section className="mb-8">
        {!editing ? (
          <>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Current balance
              <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent-primary">
                {currency}
              </span>
            </div>
            <div
              className={`mt-2 text-[44px] font-bold leading-none tracking-[-0.03em] tabular-nums ${
                account.category === "debt" ? "text-negative" : "text-text-primary"
              }`}
            >
              {account.category === "debt" ? "−" : ""}
              {formatBalance(account.balance, currency)}
            </div>
            <button
              onClick={() => setEditing(true)}
              className="mt-4 text-sm font-medium text-accent-primary underline-offset-4 hover:underline"
            >
              Update balance
            </button>
          </>
        ) : (
          <BalanceEditForm
            account={account}
            pending={pending}
            onSave={submitEdit}
            onCancel={() => setEditing(false)}
          />
        )}
      </section>

      {/* Chart */}
      <section className="mb-8">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Balance history
        </div>
        {chartData.length < 2 ? (
          <div className="flex h-[180px] items-center justify-center rounded-card border border-dashed border-text-primary/15 bg-bg-tertiary text-center text-xs text-text-secondary">
            Add another balance to see history.
          </div>
        ) : (
          <div className="h-[200px] w-full rounded-card border border-text-primary/8 bg-bg-tertiary p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <XAxis
                  dataKey="date"
                  type="number"
                  scale="time"
                  domain={["auto", "auto"]}
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }
                  tick={{ fontSize: 10, fill: "#8C8C8C" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="balance"
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
                  labelFormatter={(v) =>
                    new Date(Number(v)).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }
                  formatter={(v) => [
                    formatBalance(Number(v ?? 0), currency),
                    "Balance",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="#F04E37"
                  strokeWidth={2}
                  dot={{ fill: "#F04E37", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Last changes */}
      <section className="mb-10">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Last {Math.min(snapshots.length, 10)} change{snapshots.length === 1 ? "" : "s"}
        </div>
        {snapshots.length === 0 ? (
          <div className="rounded-card border border-text-primary/8 bg-bg-tertiary px-4 py-3 text-xs text-text-secondary">
            No changes yet.
          </div>
        ) : (
          <ul className="overflow-hidden rounded-card border border-text-primary/8 bg-bg-tertiary">
            {[...snapshots]
              .reverse()
              .slice(0, 10)
              .map((s, i, arr) => (
                <li
                  key={`${s.capturedAt}-${i}`}
                  className={`flex items-baseline justify-between px-4 py-3 ${
                    i < arr.length - 1 ? "border-b border-text-primary/6" : ""
                  }`}
                >
                  <div className="text-xs text-text-secondary">
                    {new Date(s.capturedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  <div className="text-sm font-medium tabular-nums text-text-primary">
                    {formatBalance(s.balance, currency)}
                  </div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
                    {account.source}
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* Archive */}
      <section className="mb-6">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full rounded-full border border-text-primary/15 bg-bg-tertiary py-3 text-sm font-medium text-text-secondary transition hover:border-negative/40 hover:text-negative"
          >
            Archive this account
          </button>
        ) : (
          <ArchiveConfirm
            account={account}
            snapshotCount={snapshots.length}
            pending={pending}
            onConfirm={submitArchive}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
      </section>

      {errorMsg && (
        <p className="text-center text-sm text-negative">{errorMsg}</p>
      )}
    </>
  );
}

function BalanceEditForm({
  account,
  pending,
  onSave,
  onCancel,
}: {
  account: Account;
  pending: boolean;
  onSave: (v: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(String(account.balance));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(Number(value));
      }}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
        New balance · {account.currency}
      </div>
      <input
        autoFocus
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mt-2 w-full border-b-2 border-accent-primary bg-transparent pb-2 text-[44px] font-bold tracking-[-0.025em] tabular-nums text-text-primary focus:outline-none"
      />
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-full border border-text-primary/15 bg-bg-tertiary py-3 text-sm font-semibold text-text-primary transition hover:bg-bg-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-full bg-accent-primary py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function ArchiveConfirm({
  account,
  snapshotCount,
  pending,
  onConfirm,
  onCancel,
}: {
  account: Account;
  snapshotCount: number;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className="rounded-card border border-negative/30 bg-bg-tertiary p-5"
      >
        <div className="text-sm font-semibold text-text-primary">
          Archive {account.name}?
        </div>
        <p className="mt-2 text-xs leading-relaxed text-text-secondary">
          Hides it from your home. {snapshotCount} balance snapshot
          {snapshotCount === 1 ? "" : "s"} and any check-ins stay in the
          database — restore from settings later if you change your mind.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 rounded-full border border-text-primary/15 bg-bg-tertiary py-2.5 text-sm font-semibold text-text-primary transition hover:bg-bg-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="flex-1 rounded-full bg-negative py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Archiving…" : "Archive"}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
