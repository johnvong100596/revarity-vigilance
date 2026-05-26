"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Send, AlertCircle } from "lucide-react";

import { askVigilance } from "@/lib/actions/ask";

interface AskHistoryItem {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

interface AskVigilanceClientProps {
  initialHistory: AskHistoryItem[];
  initialRemainingToday: number;
}

const PROMPT_SEEDS = [
  "What's the biggest risk I'm carrying right now?",
  "Where should I focus my attention this month?",
  "What's changed about my money in the last 90 days?",
];

export function AskVigilanceClient({
  initialHistory,
  initialRemainingToday,
}: AskVigilanceClientProps) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [latestAnswer, setLatestAnswer] = useState<{
    question: string;
    answer: string;
  } | null>(null);
  const [remaining, setRemaining] = useState(initialRemainingToday);

  function submit(q: string) {
    setError(null);
    setLatestAnswer(null);
    startTransition(async () => {
      const result = await askVigilance({ question: q });
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        if (typeof result.remainingToday === "number") {
          setRemaining(result.remainingToday);
        }
        return;
      }
      setLatestAnswer({ question: q, answer: result.answer ?? "" });
      setQuestion("");
      if (typeof result.remainingToday === "number") {
        setRemaining(result.remainingToday);
      }
      // Pull the freshly-inserted row into the history list
      router.refresh();
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    if (remaining <= 0) {
      setError("Daily limit reached. Resets at midnight UTC.");
      return;
    }
    submit(question.trim());
  }

  const noQuotaLeft = remaining <= 0;

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="rounded-card border border-text-primary/8 bg-bg-tertiary p-4"
      >
        <label
          htmlFor="ask-q"
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted"
        >
          Ask Vigilance
        </label>
        <textarea
          id="ask-q"
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, 500))}
          placeholder="Ask anything about your accounts, hints, or trajectory"
          rows={3}
          disabled={pending || noQuotaLeft}
          className="mt-2 w-full resize-none rounded-row border border-text-primary/8 bg-white px-3 py-2.5 text-[15px] text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none disabled:opacity-50"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-text-muted">
            {remaining}/5 questions left today
          </span>
          <button
            type="submit"
            disabled={pending || noQuotaLeft || !question.trim()}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent-primary px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
            {pending ? "Thinking…" : "Ask"}
          </button>
        </div>
        {!pending && !question && !latestAnswer && (
          <div className="mt-3 space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Try
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PROMPT_SEEDS.map((seed) => (
                <button
                  key={seed}
                  type="button"
                  onClick={() => setQuestion(seed)}
                  className="rounded-full border border-text-primary/8 bg-white px-2.5 py-1 text-[11px] text-text-secondary transition hover:border-accent-primary/30 hover:text-text-primary"
                >
                  {seed}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>

      {error && (
        <div className="flex items-start gap-2 rounded-card border border-hint-pay-attention/20 bg-hint-pay-attention/8 px-4 py-3 text-xs text-hint-pay-attention">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {latestAnswer && (
        <article className="rounded-card border border-text-primary/8 bg-bg-tertiary p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-primary">
            <Sparkles className="h-3 w-3" />
            Vigilance
          </div>
          <p className="mb-3 text-[11px] italic text-text-muted">
            You asked: {latestAnswer.question}
          </p>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-text-primary">
            {latestAnswer.answer}
          </p>
        </article>
      )}

      {initialHistory.length > 0 && (
        <section>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Earlier today
          </div>
          <div className="space-y-3">
            {initialHistory.map((item) => (
              <article
                key={item.id}
                className="rounded-card border border-text-primary/8 bg-bg-tertiary p-4"
              >
                <p className="mb-2 text-[12px] italic text-text-muted">
                  {item.question}
                </p>
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-text-primary">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
