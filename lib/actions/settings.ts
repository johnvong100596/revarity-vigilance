"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/* ── Profile updates ─────────────────────────────────────────── */

const UpdateProfileInput = z.object({
  displayName: z.string().max(64),
  homeCurrency: z.enum(["USD", "CAD", "EUR", "PYG"]),
  timezone: z.string().min(1).max(64),
});

export async function updateProfile(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const parsed = UpdateProfileInput.safeParse({
    displayName: String(formData.get("displayName") ?? "").trim(),
    homeCurrency: formData.get("homeCurrency"),
    timezone: String(formData.get("timezone") ?? "America/New_York"),
  });
  if (!parsed.success) {
    throw new Error(
      "Invalid input: " + JSON.stringify(parsed.error.flatten().fieldErrors)
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName || null,
      home_currency: parsed.data.homeCurrency,
      timezone: parsed.data.timezone,
    })
    .eq("id", user.id);
  if (error) throw new Error(`profile update failed: ${error.message}`);

  revalidatePath("/app");
  revalidatePath("/app/settings");
  revalidatePath("/app/checkin");
  revalidatePath("/app/reckoning");
  revalidatePath("/app/close");
}

/* ── Toggle flags ────────────────────────────────────────────── */

const ToggleInput = z.object({
  field: z.enum([
    "expert_hints_enabled",
    "decay_warnings_enabled",
    "weekly_email_enabled",
    "monthly_email_enabled",
  ]),
  value: z.boolean(),
});

export type ProfileFlag =
  | "expert_hints_enabled"
  | "decay_warnings_enabled"
  | "weekly_email_enabled"
  | "monthly_email_enabled";

export async function toggleProfileFlag(input: {
  field: ProfileFlag;
  value: boolean;
}) {
  const { field, value } = ToggleInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({ [field]: value })
    .eq("id", user.id);
  if (error) throw new Error(`toggle failed: ${error.message}`);

  revalidatePath("/app");
  revalidatePath("/app/settings");
}

/* ── Plaid item management ───────────────────────────────────── */

const PlaidItemInput = z.object({ plaidItemRowId: z.string().uuid() });

/**
 * Disconnect a Plaid item. Marks the row as disconnected (we keep the
 * access_token so the user can re-sync if they re-enable later) and
 * archives the dependent accounts so they fall out of net-worth math.
 */
export async function disconnectPlaidItem(input: { plaidItemRowId: string }) {
  const { plaidItemRowId } = PlaidItemInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error: itemErr } = await supabase
    .from("plaid_items")
    .update({ status: "disconnected" })
    .eq("id", plaidItemRowId)
    ;
  if (itemErr) throw new Error(`disconnect item failed: ${itemErr.message}`);

  const { error: acctErr } = await supabase
    .from("accounts")
    .update({ archived: true })
    .eq("plaid_item_id", plaidItemRowId);
  if (acctErr) throw new Error(`archive accounts failed: ${acctErr.message}`);

  revalidatePath("/app");
  revalidatePath("/app/settings");
  // Daily check-in + hints lists cache the account set; force them to
  // re-read so the disconnected accounts disappear immediately
  revalidatePath("/app/checkin");
  revalidatePath("/app/hints");
}

/* ── Account restore ─────────────────────────────────────────── */

const RestoreInput = z.object({ accountId: z.string().uuid() });

export async function restoreAccount(input: { accountId: string }) {
  const { accountId } = RestoreInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("accounts")
    .update({ archived: false })
    .eq("id", accountId);
  if (error) throw new Error(`restore failed: ${error.message}`);

  revalidatePath("/app");
  revalidatePath("/app/settings");
}
