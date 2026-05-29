"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { runHintsEngine } from "@/lib/hints/engine";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace";

/* ── Shared validators ─────────────────────────────────────── */

const AccountTypeEnum = z.enum(["bank", "crypto", "investment", "loan", "cash"]);
const CurrencyEnum = z.enum(["USD", "CAD", "EUR", "PYG"]);

const OptionalPositiveNumber = z
  .union([z.number(), z.null(), z.literal("")])
  .transform((v) => (v === "" || v === null ? null : Number(v)))
  .pipe(z.number().min(0).nullable());

const OptionalDayOfMonth = z
  .union([z.number(), z.null(), z.literal("")])
  .transform((v) => (v === "" || v === null ? null : Number(v)))
  .pipe(z.number().int().min(1).max(31).nullable());

const OptionalISODate = z
  .union([z.string(), z.null()])
  .transform((v) => (v === "" || v === null ? null : v))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable());

/* ── Create account ────────────────────────────────────────── */

const ACCOUNT_TYPE_CATEGORY: Record<
  z.infer<typeof AccountTypeEnum>,
  "asset" | "debt"
> = {
  bank: "asset",
  cash: "asset",
  investment: "asset",
  crypto: "asset",
  loan: "debt",
};

const AddAccountInput = z.object({
  name: z.string().min(1, "Name is required").max(64),
  subtitle: z.string().max(64).nullable(),
  account_type: AccountTypeEnum,
  currency: CurrencyEnum,
  balance: z.number().finite(),
  apr: OptionalPositiveNumber,
  credit_limit: OptionalPositiveNumber,
  statement_close_day: OptionalDayOfMonth,
  payment_due_day: OptionalDayOfMonth,
  renewal_date: OptionalISODate,
  min_payment: OptionalPositiveNumber,
});

function parseDebtFields(formData: FormData) {
  return {
    apr: formData.get("apr"),
    credit_limit: formData.get("credit_limit"),
    statement_close_day: formData.get("statement_close_day"),
    payment_due_day: formData.get("payment_due_day"),
    renewal_date: formData.get("renewal_date"),
    min_payment: formData.get("min_payment"),
  };
}

export async function addAccount(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const raw = {
    name: String(formData.get("name") ?? "").trim(),
    subtitle: String(formData.get("subtitle") ?? "").trim() || null,
    account_type: formData.get("account_type"),
    currency: formData.get("currency"),
    balance: Number(formData.get("balance") ?? 0),
    ...parseDebtFields(formData),
  };

  const parsed = AddAccountInput.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      "Invalid input: " +
        JSON.stringify(parsed.error.flatten().fieldErrors)
    );
  }
  const data = parsed.data;
  const category = ACCOUNT_TYPE_CATEGORY[data.account_type];
  const workspaceId = await getActiveWorkspaceId(supabase, user.id);

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    workspace_id: workspaceId,
    name: data.name,
    subtitle: data.subtitle,
    account_type: data.account_type,
    category,
    currency: data.currency,
    balance: data.balance,
    apr: data.account_type === "loan" ? data.apr : null,
    credit_limit: data.account_type === "loan" ? data.credit_limit : null,
    statement_close_day:
      data.account_type === "loan" ? data.statement_close_day : null,
    payment_due_day:
      data.account_type === "loan" ? data.payment_due_day : null,
    renewal_date: data.account_type === "loan" ? data.renewal_date : null,
    min_payment: data.account_type === "loan" ? data.min_payment : null,
    source: "manual",
    last_balance_updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(`Could not create account: ${error.message}`);

  await runHintsEngine(user.id, { workspaceId });
  // Revalidate so the home page reflects the new account immediately (redirect
  // throws, so this must run first).
  revalidatePath("/app");
  redirect("/app");
}

/* ── Edit balance (no check_in side-effect) ────────────────── */

const UpdateBalanceInput = z.object({
  accountId: z.string().uuid(),
  newBalance: z.number().finite(),
});

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
    .select("currency, workspace_id")
    .eq("id", accountId)
    .single();
  if (!account?.workspace_id) {
    throw new Error("Account not found or not in your workspace");
  }

  // Use workspace membership for authorization (RLS) — accounts are
  // workspace-scoped now; the user_id eq would exclude teammates
  const { error: updateErr } = await supabase
    .from("accounts")
    .update({
      balance: newBalance,
      last_balance_updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);
  if (updateErr) throw new Error(`balance update failed: ${updateErr.message}`);

  // Pull home currency for the fx_rate decision — was hardcoded to USD
  const { data: profile } = await supabase
    .from("profiles")
    .select("home_currency")
    .eq("id", user.id)
    .single();
  const homeCurrency = (profile?.home_currency as string) ?? "USD";

  const { error: snapErr } = await supabase.from("balance_snapshots").insert({
    user_id: user.id,
    workspace_id: account.workspace_id,
    account_id: accountId,
    balance: newBalance,
    balance_home_currency: newBalance,
    fx_rate: account.currency === homeCurrency ? 1 : null,
  });
  if (snapErr) throw new Error(`snapshot failed: ${snapErr.message}`);

  await runHintsEngine(user.id, { workspaceId: account.workspace_id });
  revalidatePath(`/app/accounts/${accountId}`);
  revalidatePath("/app");
  revalidatePath("/app/hints");
}

/* ── Edit debt details (APR, credit limit, etc.) ───────────── */

const UpdateDebtDetailsInput = z.object({
  accountId: z.string().uuid(),
  apr: z.number().min(0).max(100).nullable(),
  credit_limit: z.number().min(0).nullable(),
  statement_close_day: z.number().int().min(1).max(31).nullable(),
  payment_due_day: z.number().int().min(1).max(31).nullable(),
  renewal_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  min_payment: z.number().min(0).nullable(),
});

export async function updateAccountDebtDetails(input: {
  accountId: string;
  apr: number | null;
  credit_limit: number | null;
  statement_close_day: number | null;
  payment_due_day: number | null;
  renewal_date: string | null;
  min_payment: number | null;
}) {
  const parsed = UpdateDebtDetailsInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Look up the workspace so we can re-run the hint engine in the right
  // scope and to confirm the user is actually a member of the account's
  // workspace (RLS handles this too, but explicit makes the error clearer)
  const { data: acct } = await supabase
    .from("accounts")
    .select("workspace_id")
    .eq("id", parsed.accountId)
    .single();
  if (!acct?.workspace_id) {
    throw new Error("Account not found or not in your workspace");
  }

  const { error } = await supabase
    .from("accounts")
    .update({
      apr: parsed.apr,
      credit_limit: parsed.credit_limit,
      statement_close_day: parsed.statement_close_day,
      payment_due_day: parsed.payment_due_day,
      renewal_date: parsed.renewal_date,
      min_payment: parsed.min_payment,
    })
    .eq("id", parsed.accountId);
  if (error) throw new Error(`debt update failed: ${error.message}`);

  // New fields may unlock hint firings (H-002 needs credit_limit +
  // statement_close_day; H-101 needs renewal_date + apr) — re-evaluate.
  await runHintsEngine(user.id, { workspaceId: acct.workspace_id });
  revalidatePath(`/app/accounts/${parsed.accountId}`);
  revalidatePath("/app");
  revalidatePath("/app/hints");
}

/* ── Archive ───────────────────────────────────────────────── */

const ArchiveInput = z.object({
  accountId: z.string().uuid(),
});

export async function archiveAccount(input: { accountId: string }) {
  const { accountId } = ArchiveInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // RLS handles ownership check (must be owner/admin of the account's
  // workspace). Strip the user_id eq since accounts are workspace-scoped now.
  const { error } = await supabase
    .from("accounts")
    .update({ archived: true })
    .eq("id", accountId);
  if (error) throw new Error(`archive failed: ${error.message}`);

  revalidatePath("/app");
  redirect("/app");
}
