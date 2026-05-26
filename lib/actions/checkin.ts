"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { runHintsEngine } from "@/lib/hints/engine";
import { createClient } from "@/lib/supabase/server";

const SeverityScore = {
  pay_attention: 100,
  opportunity: 60,
  strategic: 40,
} as const;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * After any check-in action, decide whether this completes the day.
 * If all active accounts have a check-in for today AND we haven't already
 * counted today as complete, bump streak + last_checkin_date.
 */
async function maybeCompleteDay(userId: string) {
  const supabase = createClient();
  const today = todayISO();

  const [{ count: activeAccountsCount }, { count: checkedInCount }, { data: profile }] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("archived", false),
      supabase
        .from("check_ins")
        .select("account_id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("checkin_date", today),
      supabase
        .from("profiles")
        .select("awareness_streak, best_streak, last_checkin_date")
        .eq("id", userId)
        .single(),
    ]);

  if (!profile) return;
  if (profile.last_checkin_date === today) return;
  if (!activeAccountsCount || !checkedInCount) return;
  if (checkedInCount < activeAccountsCount) return;

  const yesterday = yesterdayISO();
  const continuingStreak = profile.last_checkin_date === yesterday;
  const newStreak = continuingStreak ? profile.awareness_streak + 1 : 1;
  const newBest = Math.max(profile.best_streak ?? 0, newStreak);

  await supabase
    .from("profiles")
    .update({
      awareness_streak: newStreak,
      best_streak: newBest,
      last_checkin_date: today,
    })
    .eq("id", userId);
}

const AcknowledgeInput = z.object({
  accountId: z.string().uuid(),
});

export async function acknowledgeAccount(input: { accountId: string }) {
  const { accountId } = AcknowledgeInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const today = todayISO();

  // upsert by the unique (user_id, account_id, checkin_date) constraint
  const { error } = await supabase.from("check_ins").upsert(
    {
      user_id: user.id,
      account_id: accountId,
      checkin_date: today,
      action: "acknowledged",
    },
    { onConflict: "user_id,account_id,checkin_date" }
  );
  if (error) throw new Error(`acknowledge failed: ${error.message}`);

  await supabase
    .from("accounts")
    .update({ last_acknowledged_at: new Date().toISOString() })
    .eq("id", accountId)
    .eq("user_id", user.id);

  await maybeCompleteDay(user.id);
  revalidatePath("/app/checkin");
  revalidatePath("/app");
}

const FlagInput = z.object({
  accountId: z.string().uuid(),
  note: z.string().min(1).max(500),
});

export async function flagAccount(input: { accountId: string; note: string }) {
  const { accountId, note } = FlagInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const today = todayISO();

  // Get account name for the hint title
  const { data: account } = await supabase
    .from("accounts")
    .select("name")
    .eq("id", accountId)
    .single();

  const { error: checkinErr } = await supabase.from("check_ins").upsert(
    {
      user_id: user.id,
      account_id: accountId,
      checkin_date: today,
      action: "flagged",
    },
    { onConflict: "user_id,account_id,checkin_date" }
  );
  if (checkinErr) throw new Error(`flag check_in failed: ${checkinErr.message}`);

  const { error: hintErr } = await supabase.from("hints").insert({
    user_id: user.id,
    hint_template_id: "user_flag",
    category: "strategic",
    severity_score: SeverityScore.strategic,
    title: `Flagged: ${account?.name ?? "account"}`,
    body: note,
    related_account_id: accountId,
    status: "active",
  });
  if (hintErr) throw new Error(`flag hint failed: ${hintErr.message}`);

  await maybeCompleteDay(user.id);
  revalidatePath("/app/checkin");
  revalidatePath("/app");
  revalidatePath("/app/hints");
}

const EditInput = z.object({
  accountId: z.string().uuid(),
  newBalance: z.number().finite(),
});

export async function editAccountBalance(input: {
  accountId: string;
  newBalance: number;
}) {
  const { accountId, newBalance } = EditInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const today = todayISO();

  const { data: account } = await supabase
    .from("accounts")
    .select("currency, workspace_id")
    .eq("id", accountId)
    .single();
  if (!account?.workspace_id) {
    throw new Error("Account not found or not in your workspace");
  }

  // Update the live balance on the account row (RLS allows since the user
  // is workspace owner/admin — for read-only members, this returns 0 rows
  // and falls through silently. Day 10 audit: surface clearer error.)
  const { error: updateErr } = await supabase
    .from("accounts")
    .update({
      balance: newBalance,
      last_balance_updated_at: new Date().toISOString(),
      last_acknowledged_at: new Date().toISOString(),
    })
    .eq("id", accountId);
  if (updateErr) throw new Error(`balance update failed: ${updateErr.message}`);

  // Write the snapshot for history (Day 6 fx-refresh will fill home-currency)
  const { error: snapErr } = await supabase.from("balance_snapshots").insert({
    user_id: user.id,
    workspace_id: account.workspace_id,
    account_id: accountId,
    balance: newBalance,
    balance_home_currency: newBalance,
    fx_rate: account?.currency === "USD" ? 1 : null,
  });
  if (snapErr) throw new Error(`snapshot failed: ${snapErr.message}`);

  const { error: checkinErr } = await supabase.from("check_ins").upsert(
    {
      user_id: user.id,
      account_id: accountId,
      checkin_date: today,
      action: "updated",
    },
    { onConflict: "user_id,account_id,checkin_date" }
  );
  if (checkinErr) throw new Error(`edit check_in failed: ${checkinErr.message}`);

  await maybeCompleteDay(user.id);
  await runHintsEngine(user.id, { workspaceId: account.workspace_id });
  revalidatePath("/app/checkin");
  revalidatePath("/app");
  revalidatePath("/app/hints");
  revalidatePath(`/app/accounts/${accountId}`);
}
