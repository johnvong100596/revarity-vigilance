"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUp, Check, Edit2, Flag } from "lucide-react";

import { ProgressRing } from "@/components/ProgressRing";
import {
  acknowledgeAccount,
  editAccountBalance,
  flagAccount,
} from "@/lib/actions/checkin";
import { formatBalance, type Currency } from "@/lib/money";
import type { Account } from "@/lib/types";

interface CheckinClientProps {
  accounts: Account[];
  initialDone: number;
}

type Mode = "swipe" | "edit" | "flag";

const SWIPE_THRESHOLD = 110;

function haptic(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(ms);
  }
}

export function CheckinClient({ accounts, initialDone }: CheckinClientProps) {
  const router = useRouter();
  const [queue, setQueue] = useState(accounts);
  const [done, setDone] = useState(initialDone);
  const total = accounts.length + initialDone;
  const current = queue[0];
  const next = queue[1];

  function resolve() {
    setQueue((q) => q.slice(1));
    setDone((d) => d + 1);
  }

  if (!current) {
    // All resolved — celebration view
    // Refresh router so /app picks up the new streak
    return <CelebrationView onContinue={() => router.push("/app")} />;
  }

  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <Link
          href="/app"
          aria-label="Back"
          className="-m-2 p-2 text-text-secondary transition hover:text-text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <ProgressRing done={done} total={total} />
      </header>

      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Checking in
        </div>
        <div className="mt-1 text-sm text-text-secondary">
          Swipe each card. Right = looks good. Up = flag it. Left = update the
          balance.
        </div>
      </div>

      <div className="relative mx-auto h-[440px] w-full">
        {next && <PeekCard />}
        <AnimatePresence>
          <CardLayer
            key={current.id}
            account={current}
            onResolve={resolve}
          />
        </AnimatePresence>
      </div>
    </>
  );
}

function PeekCard() {
  return (
    <div
      aria-hidden
      className="absolute inset-x-2 top-3 h-[420px] rounded-frame border border-text-primary/8 bg-bg-tertiary opacity-60"
    />
  );
}

function CardLayer({
  account,
  onResolve,
}: {
  account: Account;
  onResolve: () => void;
}) {
  const [mode, setMode] = useState<Mode>("swipe");
  const [exiting, setExiting] = useState<null | "right" | "up" | "fade">(null);
  const [pending, startTransition] = useTransition();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-12, 0, 12]);
  const opacity = useTransform(
    [x, y],
    ([latestX, latestY]) => {
      const dist = Math.max(Math.abs(Number(latestX)), Math.abs(Number(latestY)));
      return Math.max(0.6, 1 - dist / 400);
    }
  );

  function fireAcknowledge() {
    haptic(10);
    setExiting("right");
    startTransition(async () => {
      try {
        await acknowledgeAccount({ accountId: account.id });
      } catch (err) {
        console.error(err);
      }
    });
    setTimeout(onResolve, 280);
  }

  function fireFlagMode() {
    haptic(15);
    x.set(0);
    y.set(0);
    setMode("flag");
  }

  function fireEditMode() {
    haptic(20);
    x.set(0);
    y.set(0);
    setMode("edit");
  }

  function submitFlag(note: string) {
    if (!note.trim()) return;
    setExiting("up");
    startTransition(async () => {
      try {
        await flagAccount({ accountId: account.id, note: note.trim() });
      } catch (err) {
        console.error(err);
      }
    });
    setTimeout(onResolve, 280);
  }

  function submitEdit(newBalance: number) {
    if (!Number.isFinite(newBalance)) return;
    setExiting("fade");
    startTransition(async () => {
      try {
        await editAccountBalance({ accountId: account.id, newBalance });
      } catch (err) {
        console.error(err);
      }
    });
    setTimeout(onResolve, 280);
  }

  function handleDragEnd(
    _e: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number; y: number } }
  ) {
    if (mode !== "swipe") return;
    if (info.offset.x > SWIPE_THRESHOLD) {
      fireAcknowledge();
      return;
    }
    if (info.offset.y < -SWIPE_THRESHOLD) {
      fireFlagMode();
      return;
    }
    if (info.offset.x < -SWIPE_THRESHOLD) {
      fireEditMode();
      return;
    }
    x.set(0);
    y.set(0);
  }

  const exitAnim =
    exiting === "right"
      ? { x: 600, rotate: 25, opacity: 0 }
      : exiting === "up"
        ? { y: -600, opacity: 0 }
        : exiting === "fade"
          ? { opacity: 0, scale: 0.96 }
          : undefined;

  return (
    <motion.div
      className="absolute inset-0 touch-none"
      style={{ x, y, rotate, opacity }}
      drag={mode === "swipe"}
      dragMomentum={false}
      dragElastic={0.55}
      onDragEnd={handleDragEnd}
      animate={exitAnim}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="flex h-[420px] flex-col rounded-frame border border-text-primary/10 bg-bg-tertiary p-6 shadow-[0_20px_60px_rgba(26,26,26,0.06),0_2px_8px_rgba(26,26,26,0.03)]">
        <div className="mb-1 text-xs font-medium text-text-secondary">
          {account.name}
        </div>
        {account.subtitle && (
          <div className="text-[11px] text-text-muted">{account.subtitle}</div>
        )}

        <div className="mt-6 flex-1">
          {mode === "swipe" && <SwipeView account={account} />}
          {mode === "edit" && (
            <EditView
              account={account}
              pending={pending}
              onSubmit={submitEdit}
              onCancel={() => setMode("swipe")}
            />
          )}
          {mode === "flag" && (
            <FlagView
              pending={pending}
              onSubmit={submitFlag}
              onCancel={() => setMode("swipe")}
            />
          )}
        </div>

        {mode === "swipe" && (
          <div className="mt-4 flex items-center justify-between border-t border-text-primary/8 pt-4 text-[11px] font-semibold uppercase tracking-[0.14em]">
            <button
              type="button"
              onClick={fireEditMode}
              className="inline-flex items-center gap-1.5 text-text-secondary transition hover:text-text-primary"
            >
              <Edit2 className="h-3 w-3" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={fireFlagMode}
              className="inline-flex items-center gap-1.5 text-text-secondary transition hover:text-hint-pay-attention"
            >
              <Flag className="h-3 w-3" />
              <span>Flag</span>
            </button>
            <button
              type="button"
              onClick={fireAcknowledge}
              className="inline-flex items-center gap-1.5 text-accent-primary"
            >
              <span>Looks good</span>
              <Check className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SwipeView({ account }: { account: Account }) {
  const currency = account.currency as Currency;
  return (
    <div className="flex h-full flex-col justify-center text-center">
      <div className="text-[60px] font-bold leading-none tracking-[-0.035em] tabular-nums text-text-primary">
        {formatBalance(account.balance, currency)}
      </div>
      <div className="mt-3 text-xs text-text-secondary">
        Current balance · {currency}
      </div>
      <div className="mt-10 flex items-center justify-center gap-7 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        <span className="inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" />
          Edit
        </span>
        <span className="inline-flex items-center gap-1">
          <ArrowUp className="h-3 w-3" />
          Flag
        </span>
        <span className="inline-flex items-center gap-1 text-accent-primary">
          <ArrowRight className="h-3 w-3" />
          Looks good
        </span>
      </div>
    </div>
  );
}

function EditView({
  account,
  pending,
  onSubmit,
  onCancel,
}: {
  account: Account;
  pending: boolean;
  onSubmit: (n: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(String(account.balance));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(Number(value));
      }}
      className="flex h-full flex-col"
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        New balance ({account.currency})
      </div>
      <input
        autoFocus
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mt-2 w-full border-b-2 border-accent-primary bg-transparent pb-2 text-[44px] font-bold tracking-[-0.025em] tabular-nums text-text-primary focus:outline-none"
      />
      <div className="mt-auto flex gap-2 pt-4">
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

function FlagView({
  pending,
  onSubmit,
  onCancel,
}: {
  pending: boolean;
  onSubmit: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(note);
      }}
      className="flex h-full flex-col"
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-hint-pay-attention">
        Flag for review
      </div>
      <textarea
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What needs another look?"
        rows={5}
        className="mt-3 w-full flex-1 resize-none rounded-md border border-text-primary/12 bg-bg-primary p-3 text-sm text-text-primary placeholder:text-text-muted focus:border-hint-pay-attention/40 focus:outline-none focus:ring-2 focus:ring-hint-pay-attention/15"
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
          disabled={pending || !note.trim()}
          className="flex-1 rounded-full bg-hint-pay-attention py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Flagging…" : "Flag it"}
        </button>
      </div>
    </form>
  );
}

function CelebrationView({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center text-center">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-primary">
          Checked in
        </div>
        <h1 className="text-balance text-[40px] font-bold leading-tight tracking-[-0.025em] text-text-primary">
          See you tomorrow.
        </h1>
        <p className="mx-auto mt-5 max-w-[280px] text-sm leading-relaxed text-text-secondary">
          The ritual is the product. Show up tomorrow and the next day.
        </p>
      </motion.div>
      <button
        onClick={onContinue}
        className="mt-10 inline-flex items-center gap-2 rounded-full bg-accent-primary px-7 py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
      >
        Back to home
      </button>
    </main>
  );
}
