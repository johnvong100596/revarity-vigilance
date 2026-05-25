"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ExternalLink, Sparkles } from "lucide-react";

import { dismissHint, resolveHint } from "@/lib/actions/hints";
import type { Hint } from "@/lib/types";

const CATEGORY_LABEL = {
  pay_attention: "Pay attention",
  opportunity: "Opportunities",
  strategic: "Strategic",
} as const;

const CATEGORY_BORDER = {
  pay_attention: "border-l-hint-pay-attention",
  opportunity: "border-l-hint-opportunity",
  strategic: "border-l-hint-strategic",
} as const;

const CATEGORY_TEXT = {
  pay_attention: "text-hint-pay-attention",
  opportunity: "text-accent-primary",
  strategic: "text-hint-strategic",
} as const;

const CATEGORY_ICON = {
  pay_attention: AlertTriangle,
  opportunity: Sparkles,
  strategic: Sparkles,
} as const;

interface HintsClientProps {
  payAttention: Hint[];
  opportunity: Hint[];
  strategic: Hint[];
}

export function HintsClient({
  payAttention,
  opportunity,
  strategic,
}: HintsClientProps) {
  const sections = [
    { key: "pay_attention" as const, hints: payAttention },
    { key: "opportunity" as const, hints: opportunity },
    { key: "strategic" as const, hints: strategic },
  ];

  return (
    <div className="space-y-10">
      {sections.map(({ key, hints }) =>
        hints.length === 0 ? null : (
          <section key={key}>
            <div
              className={`mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] ${CATEGORY_TEXT[key]}`}
            >
              {CATEGORY_LABEL[key]} · {hints.length}
            </div>
            <div className="space-y-3">
              {hints.map((h) => (
                <HintCard key={h.id} hint={h} />
              ))}
            </div>
          </section>
        )
      )}
    </div>
  );
}

function HintCard({ hint }: { hint: Hint }) {
  const [removed, setRemoved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const Icon = CATEGORY_ICON[hint.category];

  function handleDismiss() {
    setRemoved(true);
    startTransition(async () => {
      try {
        await dismissHint({ hintId: hint.id });
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Failed");
        setRemoved(false);
      }
    });
  }

  function handleResolve() {
    setRemoved(true);
    startTransition(async () => {
      try {
        await resolveHint({ hintId: hint.id });
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Failed");
        setRemoved(false);
      }
    });
  }

  // Pull H-XXX prefix from the template id for the card badge
  const hintCode = hint.hint_template_id.split("-").slice(0, 2).join("-");

  const isInternalLink =
    hint.action_target?.startsWith("/") && !hint.action_target.startsWith("//");

  return (
    <AnimatePresence>
      {!removed && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0, padding: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className={`overflow-hidden rounded-card border border-text-primary/10 border-l-[3px] ${CATEGORY_BORDER[hint.category]} bg-bg-tertiary shadow-[0_1px_3px_rgba(0,0,0,0.04)]`}
        >
          <div className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${CATEGORY_TEXT[hint.category]}`} />
                <span
                  className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${CATEGORY_TEXT[hint.category]}`}
                >
                  {CATEGORY_LABEL[hint.category]}
                </span>
              </div>
              <span className="text-[10px] font-medium tabular-nums text-text-muted">
                {hintCode}
              </span>
            </div>

            <div className="text-[15px] leading-relaxed text-text-primary">
              {hint.body}
            </div>

            {hint.action_target && hint.action_label && (
              <div className="mt-4">
                {isInternalLink ? (
                  <Link
                    href={hint.action_target}
                    className={`inline-flex items-center gap-1 text-xs font-semibold ${CATEGORY_TEXT[hint.category]} underline-offset-4 hover:underline`}
                  >
                    {hint.action_label} →
                  </Link>
                ) : (
                  <a
                    href={hint.action_target}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 text-xs font-semibold ${CATEGORY_TEXT[hint.category]} underline-offset-4 hover:underline`}
                  >
                    {hint.action_label}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={handleDismiss}
                disabled={pending}
                className="flex-1 rounded-full border border-text-primary/15 bg-bg-tertiary py-2.5 text-xs font-semibold text-text-secondary transition hover:bg-bg-secondary disabled:opacity-50"
              >
                Dismiss
              </button>
              <button
                onClick={handleResolve}
                disabled={pending}
                className="flex-1 rounded-full bg-accent-primary py-2.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Got it
              </button>
            </div>
            {errorMsg && (
              <p className="mt-2 text-center text-xs text-negative">
                {errorMsg}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
