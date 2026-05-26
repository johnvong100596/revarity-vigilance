import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { AskVigilanceClient } from "@/components/AskVigilanceClient";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DAILY_CAP = 5;

export default async function AskPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Today's history (UTC day window) for the running list + remaining-quota count
  const utcMidnight = new Date();
  utcMidnight.setUTCHours(0, 0, 0, 0);

  const { data: historyRows } = await supabase
    .from("ask_history")
    .select("id, question, answer, created_at")
    .eq("user_id", user.id)
    .gte("created_at", utcMidnight.toISOString())
    .order("created_at", { ascending: false });

  // Hide in-flight placeholders (empty answer) from the visible history,
  // but they still count toward the daily cap
  const allRows = historyRows ?? [];
  const history = allRows
    .filter((r) => ((r.answer as string) ?? "").trim().length > 0)
    .map((r) => ({
      id: r.id as string,
      question: r.question as string,
      answer: r.answer as string,
      created_at: r.created_at as string,
    }));

  const remainingToday = Math.max(0, DAILY_CAP - allRows.length);

  return (
    <>
      <header className="mb-6 flex items-center gap-2">
        <Link
          href="/app"
          aria-label="Back"
          className="-m-2 p-2 text-text-secondary transition hover:text-text-primary"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold text-text-primary">
          Ask Vigilance
        </h1>
      </header>

      <p className="mb-6 text-sm leading-relaxed text-text-secondary">
        A reflection partner, not an advisor. Ask about your accounts,
        trajectory, or hints. Answers only use what Vigilance can see in
        your data — no stock picks, no tax advice.
      </p>

      <AskVigilanceClient
        initialHistory={history}
        initialRemainingToday={remainingToday}
      />
    </>
  );
}
