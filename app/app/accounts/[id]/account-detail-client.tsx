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

import { CsvImportPanel } from "@/components/CsvImportPanel";
import {
  archiveAccount,
  updateAccountBalance,
  updateAccountDebtDetails,
} from "@/lib/actions/accounts";
import { isAprVerified } from "@/lib/apr";
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

      {/* Debt details — only on debt accounts. Wires the data needed for
          H-001 (debt prio), H-002 (credit util), H-101 (mortgage renewal). */}
      {account.category === "debt" && (
        <DebtDetailsSection account={account} />
      )}

      {/* CSV import — backfill chart history from a bank export */}
      <section className="mb-8">
        <CsvImportPanel accountId={account.id} />
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

/* ── Debt details section ────────────────────────────────────── */

interface DebtFields {
  apr: number | null;
  credit_limit: number | null;
  statement_close_day: number | null;
  payment_due_day: number | null;
  renewal_date: string | null;
  min_payment: number | null;
}

function DebtDetailsSection({ account }: { account: Account }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Local state for edit form
  const [draft, setDraft] = useState<DebtFields>({
    apr: account.apr,
    credit_limit: account.credit_limit,
    statement_close_day: account.statement_close_day,
    payment_due_day: account.payment_due_day,
    renewal_date: account.renewal_date,
    min_payment: account.min_payment,
  });

  function save() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await updateAccountDebtDetails({
          accountId: account.id,
          ...draft,
        });
        setEditing(false);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Update failed");
      }
    });
  }

  const currency = account.currency as Currency;
  const hasAny =
    account.apr != null ||
    account.credit_limit != null ||
    account.statement_close_day != null ||
    account.payment_due_day != null ||
    account.renewal_date != null ||
    account.min_payment != null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Debt details
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-accent-primary underline-offset-4 hover:underline"
          >
            {hasAny ? "Edit" : "Add details"}
          </button>
        )}
      </div>

      {!editing ? (
        hasAny ? (
          <dl className="overflow-hidden rounded-card border border-text-primary/8 bg-bg-tertiary divide-y divide-text-primary/6">
            {account.apr != null && (
              <DetailRow
                label="Yearly interest"
                value={`${Number(account.apr).toFixed(2)}%`}
                hint="The percentage you pay on a year's balance"
                unverified={!isAprVerified(Number(account.apr), account)}
              />
            )}
            {account.credit_limit != null && (
              <DetailRow
                label="Credit limit"
                value={formatBalance(account.credit_limit, currency)}
              />
            )}
            {account.statement_close_day != null && (
              <DetailRow
                label="Bill cuts on"
                value={`Day ${account.statement_close_day}`}
              />
            )}
            {account.payment_due_day != null && (
              <DetailRow
                label="Pay by"
                value={`Day ${account.payment_due_day}`}
              />
            )}
            {account.min_payment != null && (
              <DetailRow
                label="Smallest payment to stay current"
                value={formatBalance(account.min_payment, currency)}
              />
            )}
            {account.renewal_date != null && (
              <DetailRow
                label="Renewal date"
                value={new Date(account.renewal_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              />
            )}
          </dl>
        ) : (
          <div className="rounded-card border border-dashed border-text-primary/15 bg-bg-tertiary p-4 text-center">
            <p className="text-xs leading-relaxed text-text-secondary">
              Add the yearly interest rate, credit limit, and when your bill
              cuts — then Vigilance can spot the patterns experts see (high
              utilization near close, costly debt, mortgages worth shopping).
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-3 inline-flex items-center text-xs font-semibold text-accent-primary underline-offset-4 hover:underline"
            >
              Add details →
            </button>
          </div>
        )
      ) : (
        <DebtEditForm
          draft={draft}
          setDraft={setDraft}
          pending={pending}
          onSave={save}
          onCancel={() => {
            setDraft({
              apr: account.apr,
              credit_limit: account.credit_limit,
              statement_close_day: account.statement_close_day,
              payment_due_day: account.payment_due_day,
              renewal_date: account.renewal_date,
              min_payment: account.min_payment,
            });
            setEditing(false);
          }}
        />
      )}
      {errorMsg && (
        <p className="mt-2 text-center text-xs text-negative">{errorMsg}</p>
      )}
    </section>
  );
}

function DetailRow({
  label,
  value,
  hint,
  unverified,
}: {
  label: string;
  value: string;
  hint?: string;
  unverified?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between px-4 py-3">
      <dt
        className={`text-xs text-text-secondary ${hint ? "cursor-help underline decoration-text-secondary/30 decoration-dotted underline-offset-2" : ""}`}
        title={hint}
      >
        {label}
      </dt>
      <dd className="flex items-center gap-1.5 text-sm font-medium tabular-nums text-text-primary">
        {value}
        {unverified && (
          <span
            title="This rate looks unusual, so we couldn't confirm it. Tap Edit to set the right number."
            className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-decay-warning/15 text-[10px] font-bold text-decay-warning"
          >
            ?
          </span>
        )}
      </dd>
    </div>
  );
}

function DebtEditForm({
  draft,
  setDraft,
  pending,
  onSave,
  onCancel,
}: {
  draft: DebtFields;
  setDraft: (next: DebtFields) => void;
  pending: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  function setField<K extends keyof DebtFields>(key: K, value: DebtFields[K]) {
    setDraft({ ...draft, [key]: value });
  }

  function toNumOrNull(v: string): number | null {
    const trimmed = v.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className="space-y-4 rounded-card border border-text-primary/10 bg-bg-tertiary p-4"
    >
      <Field label="Yearly interest (%)">
        <input
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={draft.apr ?? ""}
          onChange={(e) => setField("apr", toNumOrNull(e.target.value))}
          placeholder="e.g. 6.49"
          className="flex h-11 w-full rounded-md border border-text-primary/12 bg-bg-primary px-3.5 py-2 text-sm tabular-nums text-text-primary focus:border-accent-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-primary/15"
        />
        <p className="text-[11px] text-text-muted">
          The percentage you pay on a year&apos;s balance.
        </p>
      </Field>
      <Field label="Credit limit">
        <input
          type="number"
          step="0.01"
          min="0"
          value={draft.credit_limit ?? ""}
          onChange={(e) => setField("credit_limit", toNumOrNull(e.target.value))}
          placeholder="Credit cards only"
          className="flex h-11 w-full rounded-md border border-text-primary/12 bg-bg-primary px-3.5 py-2 text-sm tabular-nums text-text-primary focus:border-accent-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-primary/15"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Day bill cuts">
          <input
            type="number"
            min="1"
            max="31"
            value={draft.statement_close_day ?? ""}
            onChange={(e) =>
              setField("statement_close_day", toNumOrNull(e.target.value))
            }
            placeholder="1–31"
            className="flex h-11 w-full rounded-md border border-text-primary/12 bg-bg-primary px-3.5 py-2 text-sm tabular-nums text-text-primary focus:border-accent-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-primary/15"
          />
        </Field>
        <Field label="Day to pay by">
          <input
            type="number"
            min="1"
            max="31"
            value={draft.payment_due_day ?? ""}
            onChange={(e) =>
              setField("payment_due_day", toNumOrNull(e.target.value))
            }
            placeholder="1–31"
            className="flex h-11 w-full rounded-md border border-text-primary/12 bg-bg-primary px-3.5 py-2 text-sm tabular-nums text-text-primary focus:border-accent-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-primary/15"
          />
        </Field>
      </div>
      <Field label="Smallest payment to stay current">
        <input
          type="number"
          step="0.01"
          min="0"
          value={draft.min_payment ?? ""}
          onChange={(e) => setField("min_payment", toNumOrNull(e.target.value))}
          placeholder="Monthly minimum"
          className="flex h-11 w-full rounded-md border border-text-primary/12 bg-bg-primary px-3.5 py-2 text-sm tabular-nums text-text-primary focus:border-accent-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-primary/15"
        />
      </Field>
      <Field label="Renewal date (mortgages)">
        <input
          type="date"
          value={draft.renewal_date ?? ""}
          onChange={(e) =>
            setField("renewal_date", e.target.value === "" ? null : e.target.value)
          }
          className="flex h-11 w-full rounded-md border border-text-primary/12 bg-bg-primary px-3.5 py-2 text-sm tabular-nums text-text-primary focus:border-accent-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-primary/15"
        />
      </Field>
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="flex-1 rounded-full border border-text-primary/15 bg-bg-tertiary py-3 text-sm font-semibold text-text-primary transition hover:bg-bg-secondary disabled:opacity-50"
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
        {label}
      </div>
      {children}
    </div>
  );
}
