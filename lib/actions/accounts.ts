"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { runHintsEngine } from "@/lib/hints/engine";
import { createClient } from "@/lib/supabase/server";

const UpdateBalanceInput = z.object({
  accountId: z.string().uuid(),
  newBalance: z.number().finite(),
});

/**
 * Update a single account's balance WITHOUT creating a check_in row.
 * (Use editAccountBalance from lib/actions/checkin.ts for the ritual variant
 * that also writes a check_in.)
 */
export async function updateAccountBalance(input: {
  accountId: string;
  newBalance: number;
}) {
  const { accountId, newBalance } = UpdateBalanceInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: account } = await supabase
    .from("accounts")
    .select("currency")
    .eq("id", accountId)
    .single();

  const { error: updateErr } = await supabase
    .from("accounts")
    .update({
      balance: newBalance,
      last_balance_updated_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .eq("user_id", user.id);
  if (updateErr) throw new Error(`balance update failed: ${updateErr.message}`);

  const { error: snapErr } = await supabase.from("balance_snapshots").insert({
    user_id: user.id,
    account_id: accountId,
    balance: newBalance,
    balance_home_currency: newBalance,
    fx_rate: account?.currency === "USD" ? 1 : null,
  });
  if (snapErr) throw new Error(`snapshot failed: ${snapErr.message}`);

  await runHintsEngine(user.id);
  revalidatePath(`/app/accounts/${accountId}`);
  revalidatePath("/app");
  revalidatePath("/app/hints");
}

const ArchiveInput = z.object({
  accountId: z.string().uuid(),
});

/**
 * Soft-delete: set archived=true. The home query filters this out so it
 * disappears from the UI. Data is preserved (snapshots, check_ins, hints)
 * and could be restored by flipping archived=false from settings later.
 */
export async function archiveAccount(input: { accountId: string }) {
  const { accountId } = ArchiveInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("accounts")
    .update({ archived: true })
    .eq("id", accountId)
    .eq("user_id", user.id);
  if (error) throw new Error(`archive failed: ${error.message}`);

  revalidatePath("/app");
  redirect("/app");
}
