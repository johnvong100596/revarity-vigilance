import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";

import { CheckinClient } from "./checkin-client";
import { createClient } from "@/lib/supabase/server";
import type { Account } from "@/lib/types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function CheckinPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = todayISO();

  const [accountsRes, checkinsRes, profileRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("archived", false)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("check_ins")
      .select("account_id")
      .eq("user_id", user.id)
      .eq("checkin_date", today),
    supabase
      .from("profiles")
      .select("awareness_streak, last_checkin_date")
      .eq("id", user.id)
      .single(),
  ]);

  const allAccounts: Account[] = accountsRes.data ?? [];
  const checkedInIds = new Set(
    (checkinsRes.data ?? []).map((c) => c.account_id as string)
  );
  const remaining = allAccounts.filter((a) => !checkedInIds.has(a.id));
  const doneCount = checkedInIds.size;
  const profile = profileRes.data;
  const streak = profile?.awareness_streak ?? 0;
  const finishedToday = profile?.last_checkin_date === today;

  // 0 accounts → nudge to add one
  if (allAccounts.length === 0) {
    return (
      <>
        <header className="mb-8 flex items-center justify-between">
          <Link
            href="/app"
            aria-label="Back"
            className="-m-2 p-2 text-text-secondary transition hover:text-text-primary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </header>
        <section className="mt-16 flex flex-col items-center text-center">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Nothing to check in
          </div>
          <p className="mb-10 max-w-[300px] text-[15px] leading-relaxed text-text-secondary">
            Add at least one account and the ritual begins.
          </p>
          <Link
            href="/app/accounts/add"
            className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-6 py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add your first account
          </Link>
        </section>
      </>
    );
  }

  // Already finished today → summary view
  if (remaining.length === 0) {
    return (
      <>
        <header className="mb-8 flex items-center justify-between">
          <Link
            href="/app"
            aria-label="Back"
            className="-m-2 p-2 text-text-secondary transition hover:text-text-primary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-positive">
            Done for today
          </div>
        </header>
        <section className="mt-12 flex flex-col items-center text-center">
          <div className="text-[64px] font-bold leading-none tracking-[-0.04em] tabular-nums text-accent-primary">
            {streak}
          </div>
          <div className="mt-3 text-sm font-medium text-text-primary">
            day streak
          </div>
          <p className="mx-auto mt-8 max-w-[300px] text-[15px] leading-relaxed text-text-secondary">
            {finishedToday
              ? "All accounts acknowledged today. See you tomorrow."
              : "You're caught up for now."}
          </p>
          <Link
            href="/app"
            className="mt-10 inline-flex items-center gap-2 rounded-full border border-text-primary/15 bg-bg-tertiary px-6 py-3 text-sm font-semibold text-text-primary transition hover:bg-bg-secondary"
          >
            Back to home
          </Link>
        </section>
      </>
    );
  }

  return <CheckinClient accounts={remaining} initialDone={doneCount} />;
}
