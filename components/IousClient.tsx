"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Repeat, Trash2 } from "lucide-react";

import {
  createFlow,
  createIou,
  deleteFlow,
  deleteIou,
  settleFlow,
  settleIou,
} from "@/lib/actions/ious";
import { formatBalance, type Currency } from "@/lib/money";
import type { Entity, InterEntityFlow, Iou } from "@/lib/types";

type Tab = "owe" | "owed" | "flows";

interface IousClientProps {
  ious: Iou[];
  flows: InterEntityFlow[];
  entities: Entity[];
  homeCurrency: Currency;
}

export function IousClient({
  ious,
  flows,
  entities,
  homeCurrency,
}: IousClientProps) {
  const [tab, setTab] = useState<Tab>("owe");
  const [adding, setAdding] = useState(false);

  const owe = ious.filter((i) => i.direction === "i_owe");
  const owed = ious.filter((i) => i.direction === "owed_to_me");
  const oweTotal = owe
    .filter((i) => i.status === "active")
    .reduce((s, i) => s + Number(i.amount), 0);
  const owedTotal = owed
    .filter((i) => i.status === "active")
    .reduce((s, i) => s + Number(i.amount), 0);
  const flowsActiveCount = flows.filter((f) => f.status === "active").length;

  const tabs: { key: Tab; label: string; count?: string }[] = [
    {
      key: "owe",
      label: "I owe",
      count: oweTotal > 0
        ? formatBalance(oweTotal, homeCurrency, { roundWholeAbove1000: true })
        : undefined,
    },
    {
      key: "owed",
      label: "Owed to me",
      count: owedTotal > 0
        ? formatBalance(owedTotal, homeCurrency, { roundWholeAbove1000: true })
        : undefined,
    },
    {
      key: "flows",
      label: "Between mine",
      count: flowsActiveCount > 0 ? String(flowsActiveCount) : undefined,
    },
  ];

  return (
    <div>
      {/* Tabs */}
      <div className="-mx-1 mb-5 overflow-x-auto">
        <div className="flex gap-2 px-1 pb-1">
          {tabs.map((t) => {
            const isOn = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  setAdding(false);
                }}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  isOn
                    ? "border-accent-primary bg-accent-primary text-white"
                    : "border-text-primary/10 bg-bg-tertiary text-text-secondary hover:border-accent-primary/30"
                }`}
              >
                {t.label}
                {t.count && (
                  <span
                    className={`tabular-nums ${isOn ? "text-white/80" : "text-text-muted"}`}
                  >
                    · {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs leading-relaxed text-text-secondary">
          {tab === "owe" && "Money you owe to people outside the app."}
          {tab === "owed" && "Money people owe you."}
          {tab === "flows" && "Money you've moved between your own businesses."}
        </p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent-primary"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-4">
          {tab === "flows" ? (
            <FlowForm
              entities={entities}
              homeCurrency={homeCurrency}
              onDone={() => setAdding(false)}
            />
          ) : (
            <IouForm
              direction={tab === "owe" ? "i_owe" : "owed_to_me"}
              entities={entities}
              homeCurrency={homeCurrency}
              onDone={() => setAdding(false)}
            />
          )}
        </div>
      )}

      {tab === "owe" && (
        <IouList rows={owe} entities={entities} homeCurrency={homeCurrency} />
      )}
      {tab === "owed" && (
        <IouList rows={owed} entities={entities} homeCurrency={homeCurrency} />
      )}
      {tab === "flows" && (
        <FlowList rows={flows} entities={entities} homeCurrency={homeCurrency} />
      )}
    </div>
  );
}

/* ── Row lists ──────────────────────────────────────────────────── */

function IouList({
  rows,
  entities,
  homeCurrency,
}: {
  rows: Iou[];
  entities: Entity[];
  homeCurrency: Currency;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-text-primary/8 bg-bg-tertiary px-4 py-6 text-center text-xs text-text-muted">
        Nothing here yet. Tap Add to log one.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((iou) => (
        <li key={iou.id}>
          <IouRow iou={iou} entities={entities} homeCurrency={homeCurrency} />
        </li>
      ))}
    </ul>
  );
}

function IouRow({
  iou,
  entities,
  homeCurrency,
}: {
  iou: Iou;
  entities: Entity[];
  homeCurrency: Currency;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const entity = entities.find((e) => e.id === iou.entity_id) ?? null;
  const currency = (iou.currency as Currency) || homeCurrency;
  const isSettled = iou.status === "settled";

  function handleSettle() {
    startTransition(async () => {
      try {
        await settleIou({ id: iou.id });
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Could not settle");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Delete this entry for ${iou.counterparty_name}?`)) return;
    startTransition(async () => {
      try {
        await deleteIou({ id: iou.id });
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Could not delete");
      }
    });
  }

  let dueLabel: string | null = null;
  if (iou.due_date) {
    const d = new Date(iou.due_date);
    dueLabel = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div
      className={`rounded-card border border-text-primary/8 bg-bg-tertiary p-3.5 ${
        isSettled ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`truncate text-sm font-medium ${
                isSettled
                  ? "text-text-muted line-through"
                  : "text-text-primary"
              }`}
            >
              {iou.counterparty_name}
            </span>
            {iou.recurring && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-primary">
                <Repeat className="h-2.5 w-2.5" /> monthly
              </span>
            )}
            {entity && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-text-muted">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entity.color_hex }}
                />
                {entity.name}
              </span>
            )}
          </div>
          {dueLabel && !isSettled && (
            <div className="mt-0.5 text-xs text-text-secondary">
              Due {dueLabel}
            </div>
          )}
          {isSettled && iou.settled_at && (
            <div className="mt-0.5 text-xs text-text-muted">
              Settled {new Date(iou.settled_at).toLocaleDateString()}
            </div>
          )}
          {iou.notes && (
            <div className="mt-1 text-[11px] text-text-muted">{iou.notes}</div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular-nums text-text-primary">
            {formatBalance(Number(iou.amount), currency, {
              roundWholeAbove1000: true,
            })}
          </div>
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        {!isSettled && (
          <button
            type="button"
            onClick={handleSettle}
            disabled={pending}
            className="rounded-full bg-accent-primary px-3 py-1.5 text-[11px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Mark settled
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          aria-label="Delete"
          className="rounded-full border border-text-primary/15 p-1.5 text-text-secondary transition hover:border-negative/30 hover:text-negative disabled:opacity-50"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function FlowList({
  rows,
  entities,
  homeCurrency,
}: {
  rows: InterEntityFlow[];
  entities: Entity[];
  homeCurrency: Currency;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-text-primary/8 bg-bg-tertiary px-4 py-6 text-center text-xs text-text-muted">
        Nothing here yet. Log a transfer when you lend money from one of your
        businesses to another.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((f) => (
        <li key={f.id}>
          <FlowRow flow={f} entities={entities} homeCurrency={homeCurrency} />
        </li>
      ))}
    </ul>
  );
}

function FlowRow({
  flow,
  entities,
  homeCurrency,
}: {
  flow: InterEntityFlow;
  entities: Entity[];
  homeCurrency: Currency;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const from = entities.find((e) => e.id === flow.from_entity_id) ?? null;
  const to = entities.find((e) => e.id === flow.to_entity_id) ?? null;
  const currency = (flow.currency as Currency) || homeCurrency;
  const isSettled = flow.status === "settled";

  function handleSettle() {
    startTransition(async () => {
      try {
        await settleFlow({ id: flow.id });
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Could not settle");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Delete this transfer?")) return;
    startTransition(async () => {
      try {
        await deleteFlow({ id: flow.id });
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Could not delete");
      }
    });
  }

  return (
    <div
      className={`rounded-card border border-text-primary/8 bg-bg-tertiary p-3.5 ${
        isSettled ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={`text-sm font-medium ${
              isSettled ? "text-text-muted line-through" : "text-text-primary"
            }`}
          >
            <span className="inline-flex items-center gap-1">
              {from && (
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: from.color_hex }}
                />
              )}
              {from?.name ?? "—"}
            </span>
            <span className="mx-1.5 text-text-muted">→</span>
            <span className="inline-flex items-center gap-1">
              {to && (
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: to.color_hex }}
                />
              )}
              {to?.name ?? "—"}
            </span>
          </div>
          {flow.purpose && (
            <div className="mt-0.5 text-xs text-text-secondary">
              {flow.purpose}
            </div>
          )}
          <div className="mt-0.5 text-[11px] text-text-muted">
            {new Date(flow.flow_date).toLocaleDateString()}
            {isSettled && flow.settled_at && (
              <> · settled {new Date(flow.settled_at).toLocaleDateString()}</>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular-nums text-text-primary">
            {formatBalance(Number(flow.amount), currency, {
              roundWholeAbove1000: true,
            })}
          </div>
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        {!isSettled && (
          <button
            type="button"
            onClick={handleSettle}
            disabled={pending}
            className="rounded-full bg-accent-primary px-3 py-1.5 text-[11px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Mark settled
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          aria-label="Delete"
          className="rounded-full border border-text-primary/15 p-1.5 text-text-secondary transition hover:border-negative/30 hover:text-negative disabled:opacity-50"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/* ── Forms ──────────────────────────────────────────────────────── */

const INPUT =
  "flex h-10 w-full rounded-md border border-text-primary/12 bg-bg-primary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-primary/15";

function IouForm({
  direction,
  entities,
  homeCurrency,
  onDone,
}: {
  direction: "i_owe" | "owed_to_me";
  entities: Entity[];
  homeCurrency: Currency;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(homeCurrency);
  const [dueDate, setDueDate] = useState("");
  const [entityId, setEntityId] = useState<string>("");
  const [recurringDay, setRecurringDay] = useState<string>(""); // empty = not recurring
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 0) {
      setError("Enter an amount.");
      return;
    }
    const recurring =
      recurringDay.trim() === ""
        ? null
        : { frequency: "monthly" as const, day_of_month: Number(recurringDay) };
    startTransition(async () => {
      try {
        await createIou({
          counterpartyName: name.trim(),
          amount: numAmount,
          currency,
          direction,
          dueDate: dueDate || null,
          entityId: entityId || null,
          recurring,
          notes: notes.trim() || null,
        });
        router.refresh();
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add");
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
        onChange={(e) => setName(e.target.value)}
        placeholder={
          direction === "i_owe"
            ? "Who you owe (e.g. Mom, Bank, Vu)"
            : "Who owes you"
        }
        maxLength={80}
        className={INPUT}
      />
      <div className="flex gap-2">
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className={INPUT}
        />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Currency)}
          className={INPUT + " w-28"}
        >
          <option value="USD">USD</option>
          <option value="CAD">CAD</option>
          <option value="EUR">EUR</option>
          <option value="PYG">PYG</option>
        </select>
      </div>
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Due date (optional)
          </span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="flex w-32 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Recurring day
          </span>
          <input
            type="number"
            min={1}
            max={31}
            placeholder="—"
            value={recurringDay}
            onChange={(e) => setRecurringDay(e.target.value)}
            className={INPUT}
          />
        </label>
      </div>
      {entities.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Tag to a business (optional)
          </span>
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className={INPUT}
          >
            <option value="">Not tagged</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        maxLength={500}
        className={INPUT}
      />
      {error && <p className="text-xs text-negative">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 rounded-full border border-text-primary/15 bg-bg-tertiary py-2 text-xs font-semibold text-text-primary transition hover:bg-bg-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !name.trim() || !amount}
          className="flex-1 rounded-full bg-accent-primary py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add"}
        </button>
      </div>
    </form>
  );
}

function FlowForm({
  entities,
  homeCurrency,
  onDone,
}: {
  entities: Entity[];
  homeCurrency: Currency;
  onDone: () => void;
}) {
  const router = useRouter();
  const [fromId, setFromId] = useState<string>(entities[0]?.id ?? "");
  const [toId, setToId] = useState<string>(entities[1]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(homeCurrency);
  const [purpose, setPurpose] = useState("");
  const [flowDate, setFlowDate] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (entities.length < 2) {
      setError("Add at least two businesses in Settings first.");
      return;
    }
    if (fromId === toId) {
      setError("Pick two different businesses.");
      return;
    }
    const num = Number(amount);
    if (!Number.isFinite(num) || num < 0) {
      setError("Enter an amount.");
      return;
    }
    startTransition(async () => {
      try {
        await createFlow({
          fromEntityId: fromId,
          toEntityId: toId,
          amount: num,
          currency,
          purpose: purpose.trim() || null,
          flowDate: flowDate || undefined,
        });
        router.refresh();
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-card border border-text-primary/12 bg-bg-tertiary p-3"
    >
      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            From
          </span>
          <select
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            className={INPUT}
          >
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <span className="pb-2 text-text-muted">→</span>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            To
          </span>
          <select
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            className={INPUT}
          >
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className={INPUT}
        />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Currency)}
          className={INPUT + " w-28"}
        >
          <option value="USD">USD</option>
          <option value="CAD">CAD</option>
          <option value="EUR">EUR</option>
          <option value="PYG">PYG</option>
        </select>
      </div>
      <input
        type="text"
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
        placeholder="What for? (e.g. payroll loan)"
        maxLength={200}
        className={INPUT}
      />
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Date
        </span>
        <input
          type="date"
          value={flowDate}
          onChange={(e) => setFlowDate(e.target.value)}
          className={INPUT}
        />
      </label>
      {error && <p className="text-xs text-negative">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 rounded-full border border-text-primary/15 bg-bg-tertiary py-2 text-xs font-semibold text-text-primary transition hover:bg-bg-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !amount || entities.length < 2}
          className="flex-1 rounded-full bg-accent-primary py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add"}
        </button>
      </div>
    </form>
  );
}
