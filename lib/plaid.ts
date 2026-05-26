import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Environment selection — Plaid production access was approved 2026-05-26.
 *
 * Priority order:
 *   1. PLAID_ENV explicit override (used locally for testing prod against
 *      sandbox or vice versa)
 *   2. VERCEL_ENV === "production" → Plaid production
 *   3. anything else (preview deploys, local dev) → Plaid sandbox
 *
 * This means a preview deployment NEVER accidentally uses production
 * credentials, even if PLAID_CLIENT_ID_PROD is set in the env.
 */
export function getPlaidEnvironment(): "sandbox" | "production" | "development" {
  const explicit = process.env.PLAID_ENV;
  if (explicit === "production") return "production";
  if (explicit === "sandbox") return "sandbox";
  if (explicit === "development") return "development";
  if (process.env.VERCEL_ENV === "production") return "production";
  return "sandbox";
}

function getPlaidCreds(): { clientId: string; secret: string } {
  if (getPlaidEnvironment() === "production") {
    const clientId = process.env.PLAID_CLIENT_ID_PROD;
    const secret = process.env.PLAID_SECRET_PROD;
    if (!clientId || !secret) {
      throw new Error(
        "Plaid production mode requires PLAID_CLIENT_ID_PROD and PLAID_SECRET_PROD env vars"
      );
    }
    return { clientId, secret };
  }
  return {
    clientId: process.env.PLAID_CLIENT_ID!,
    secret: process.env.PLAID_SECRET!,
  };
}

function buildClient(): PlaidApi {
  const env = getPlaidEnvironment();
  const { clientId, secret } = getPlaidCreds();
  const config = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });
  return new PlaidApi(config);
}

// Cache invalidates per-process — Vercel functions get fresh instances
// when env changes (which happens on redeploy).
let cached: PlaidApi | null = null;
export function plaid(): PlaidApi {
  if (!cached) cached = buildClient();
  return cached;
}

/* ── Vault encryption for access tokens ────────────────────────── */

/**
 * Encrypts a Plaid access token via Supabase Vault. Returns the UUID
 * reference that we store in plaid_items.access_token_encrypted.
 *
 * The plaintext token never leaves Postgres — pgsodium-backed encryption
 * key is managed by Supabase. App server only sees the UUID after this
 * call returns.
 *
 * ARCHITECTURE.md §5: "access_token NEVER leaves server. Encrypted at
 * rest via Supabase Vault."
 */
export async function encryptPlaidToken(
  accessToken: string,
  plaidItemId: string
): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("vault_create_secret", {
    secret: accessToken,
    secret_name: `plaid_token_${plaidItemId}_${Date.now()}`,
  });
  if (error || !data) {
    throw new Error(
      `Vault encryption failed: ${error?.message ?? "no UUID returned"}`
    );
  }
  return data as string;
}

/**
 * Decrypts a Plaid access token by UUID reference. Called from server-side
 * routes (sync, webhook) right before invoking the Plaid SDK.
 */
export async function decryptPlaidToken(secretUuid: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("vault_get_secret", {
    secret_id: secretUuid,
  });
  if (error || data == null) {
    throw new Error(
      `Vault decryption failed: ${error?.message ?? "no plaintext returned"}`
    );
  }
  return data as string;
}

/** Products requested when creating Link tokens. Liabilities + investments
 *  unlock the H-002 / H-101 / H-201 hint data sources. */
export const LINK_PRODUCTS: Products[] = [
  Products.Transactions,
  Products.Liabilities,
  Products.Investments,
];

export const LINK_COUNTRY_CODES: CountryCode[] = [
  CountryCode.Us,
  CountryCode.Ca,
];

/** Map Plaid's `type` taxonomy to our account_type CHECK enum. */
export function mapPlaidAccountType(plaidType: string): "bank" | "investment" | "loan" | "cash" {
  switch (plaidType) {
    case "depository":
      return "bank";
    case "investment":
    case "brokerage":
      return "investment";
    case "credit":
    case "loan":
      return "loan";
    default:
      return "bank";
  }
}

/** Plaid 'type' → our category enum (asset vs debt). */
export function mapPlaidCategory(plaidType: string): "asset" | "debt" {
  return plaidType === "credit" || plaidType === "loan" ? "debt" : "asset";
}

/* ── Liabilities refresh ───────────────────────────────────────── */

export interface LiabilitiesRefreshResult {
  credit: number;
  mortgage: number;
  student: number;
}

/**
 * Fetches liabilitiesGet for a Plaid item and propagates the debt-specific
 * fields onto matching accounts rows:
 *   - credit cards → apr, statement_close_day, payment_due_day, min_payment
 *   - mortgages    → apr, payment_due_day (renewal_date stays null — Plaid's
 *                    maturity_date is final-payoff, not a Canadian-style
 *                    rate-reset renewal; user edits manually if they want
 *                    H-101 to fire)
 *   - student loans → apr, payment_due_day, min_payment
 *
 * Swallows errors: some institutions don't support the Liabilities product,
 * Plaid returns NO_LIABILITY_ACCOUNTS in that case and we don't want to
 * break the parent request that called us.
 *
 * Accepts ANY Supabase client (cookie-auth from server.ts OR service-role
 * from admin.ts) — caller passes whichever they have access to.
 */
export async function refreshLiabilitiesForItem(opts: {
  accessToken: string;
  userId: string;
  supabase: SupabaseClient;
}): Promise<LiabilitiesRefreshResult> {
  const result: LiabilitiesRefreshResult = {
    credit: 0,
    mortgage: 0,
    student: 0,
  };

  try {
    const res = await plaid().liabilitiesGet({
      access_token: opts.accessToken,
    });
    const liabilities = res.data.liabilities;

    if (liabilities?.credit) {
      for (const c of liabilities.credit) {
        const purchaseApr =
          c.aprs?.find((a) => a.apr_type === "purchase_apr")?.apr_percentage ??
          c.aprs?.[0]?.apr_percentage ??
          null;
        const statementCloseDay = c.last_statement_issue_date
          ? new Date(c.last_statement_issue_date).getUTCDate()
          : null;
        const paymentDueDay = c.next_payment_due_date
          ? new Date(c.next_payment_due_date).getUTCDate()
          : null;

        const { error } = await opts.supabase
          .from("accounts")
          .update({
            apr: purchaseApr,
            statement_close_day: statementCloseDay,
            payment_due_day: paymentDueDay,
            min_payment: c.minimum_payment_amount ?? null,
          })
          .eq("user_id", opts.userId)
          .eq("plaid_account_id", c.account_id);
        if (!error) result.credit++;
      }
    }

    if (liabilities?.mortgage) {
      for (const m of liabilities.mortgage) {
        const paymentDueDay = m.next_payment_due_date
          ? new Date(m.next_payment_due_date).getUTCDate()
          : null;
        const apr = m.interest_rate?.percentage ?? null;

        const { error } = await opts.supabase
          .from("accounts")
          .update({
            apr,
            payment_due_day: paymentDueDay,
            // renewal_date deliberately not set — see fn-level comment
          })
          .eq("user_id", opts.userId)
          .eq("plaid_account_id", m.account_id);
        if (!error) result.mortgage++;
      }
    }

    if (liabilities?.student) {
      for (const s of liabilities.student) {
        const paymentDueDay = s.next_payment_due_date
          ? new Date(s.next_payment_due_date).getUTCDate()
          : null;
        const apr = s.interest_rate_percentage ?? null;

        const { error } = await opts.supabase
          .from("accounts")
          .update({
            apr,
            payment_due_day: paymentDueDay,
            min_payment: s.minimum_payment_amount ?? null,
          })
          .eq("user_id", opts.userId)
          .eq("plaid_account_id", s.account_id);
        if (!error) result.student++;
      }
    }
  } catch (e) {
    console.error("[plaid] refreshLiabilitiesForItem", e);
  }

  return result;
}
