import { NextResponse, type NextRequest } from "next/server";

import {
  decryptPlaidToken,
  plaid,
  refreshLiabilitiesForItem,
} from "@/lib/plaid";
import { verifyPlaidWebhook } from "@/lib/plaid-webhook-verify";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Plaid webhook endpoint.
 *
 * Webhooks arrive unauthenticated by HTTP standards — Plaid sends a
 * signed JWT in the `plaid-verification` header and the body is the
 * payload. Every request is verified against Plaid's
 * webhook_verification_key endpoint by verifyPlaidWebhook (lib/plaid-
 * webhook-verify.ts) before any DB access.
 *
 * We use the admin client (service_role) here because the request isn't
 * authenticated as a specific user; we look up the workspace_id from the
 * plaid_items row keyed by Plaid's item_id. Service-role bypasses RLS,
 * so every query in this handler MUST explicitly scope by workspace_id
 * AND plaid_item_id when joining downstream tables.
 */

interface PlaidWebhookPayload {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  error?: unknown;
  new_transactions?: number;
  account_ids_with_updated_liabilities?: string[];
  account_ids_with_new_holdings?: string[];
}

export async function POST(req: NextRequest) {
  // Need the raw body twice: once for SHA-256 verification, once parsed
  const bodyText = await req.text();
  const verified = await verifyPlaidWebhook(
    req.headers.get("plaid-verification"),
    bodyText
  );
  if (!verified) {
    console.warn("[plaid webhook] rejected: signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: PlaidWebhookPayload;
  try {
    payload = JSON.parse(bodyText) as PlaidWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log(
    `[plaid webhook] ${payload.webhook_type}/${payload.webhook_code} item=${payload.item_id}`
  );

  const admin = createAdminClient();
  const { data: item } = await admin
    .from("plaid_items")
    .select("id, user_id, workspace_id, access_token_encrypted")
    .eq("plaid_item_id", payload.item_id)
    .maybeSingle();
  if (!item) {
    console.warn("[plaid webhook] unknown item_id", payload.item_id);
    // Return 503 (not 200) so Plaid retries with backoff — protects against
    // the exchange→webhook race where the first webhook arrives before the
    // plaid_items row commits
    return NextResponse.json(
      { error: "unknown item_id" },
      { status: 503 }
    );
  }

  try {
    switch (payload.webhook_type) {
      case "TRANSACTIONS":
      case "HOLDINGS": {
        const accessToken = await decryptPlaidToken(
          item.access_token_encrypted
        );
        await refreshBalancesFromPlaid({
          accessToken,
          userId: item.user_id,
          workspaceId: item.workspace_id,
          plaidItemRowId: item.id,
        });
        break;
      }
      case "LIABILITIES": {
        const accessToken = await decryptPlaidToken(
          item.access_token_encrypted
        );
        await refreshBalancesFromPlaid({
          accessToken,
          userId: item.user_id,
          workspaceId: item.workspace_id,
          plaidItemRowId: item.id,
          withLiabilities: true,
        });
        break;
      }
      case "ITEM":
        if (payload.webhook_code === "ERROR") {
          await admin
            .from("plaid_items")
            .update({ status: "error" })
            .eq("id", item.id);
        }
        if (payload.webhook_code === "PENDING_EXPIRATION") {
          await admin
            .from("plaid_items")
            .update({ status: "disconnected" })
            .eq("id", item.id);
        }
        break;
      default:
        break;
    }
  } catch (e) {
    console.error("[plaid webhook] handler", e);
    // Still return 200 — Plaid will retry but we don't want backpressure
  }

  return NextResponse.json({ ok: true });
}

async function refreshBalancesFromPlaid({
  accessToken,
  userId,
  workspaceId,
  plaidItemRowId,
  withLiabilities = false,
}: {
  accessToken: string;
  userId: string;
  workspaceId: string;
  plaidItemRowId: string;
  /** True for LIABILITIES webhook events — also re-fetches debt fields */
  withLiabilities?: boolean;
}) {
  const admin = createAdminClient();
  // Resolve home currency for the workspace owner so we can mark
  // snapshot fx_rate=1 when account currency matches (rather than
  // hardcoding USD as home)
  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("home_currency")
    .eq("id", userId)
    .single();
  const homeCurrency =
    (ownerProfile?.home_currency as string | undefined) ?? "USD";

  const res = await plaid().accountsGet({ access_token: accessToken });
  const now = new Date().toISOString();

  for (const a of res.data.accounts) {
    const balance = Math.abs(a.balances.current ?? 0);
    const creditLimit = a.balances.limit ?? null;

    // Triple-scope the lookup: workspace + plaid_item + plaid_account.
    // Plaid account_ids are not globally unique by spec — adding
    // plaid_item_id makes a cross-workspace collision impossible since
    // plaid_item_id is unique per linked institution per workspace.
    const { data: acct } = await admin
      .from("accounts")
      .select("id, currency, category")
      .eq("workspace_id", workspaceId)
      .eq("plaid_item_id", plaidItemRowId)
      .eq("plaid_account_id", a.account_id)
      .maybeSingle();
    if (!acct) continue;

    await admin
      .from("accounts")
      .update({
        balance,
        credit_limit: acct.category === "debt" ? creditLimit : null,
        last_balance_updated_at: now,
      })
      .eq("id", acct.id);

    await admin.from("balance_snapshots").insert({
      user_id: userId,
      workspace_id: workspaceId,
      account_id: acct.id,
      balance,
      balance_home_currency: balance,
      fx_rate: acct.currency === homeCurrency ? 1 : null,
    });
  }

  if (withLiabilities) {
    await refreshLiabilitiesForItem({
      accessToken,
      userId,
      supabase: admin,
    });
  }

  await admin
    .from("plaid_items")
    .update({ last_sync_at: now })
    .eq("id", plaidItemRowId);
}
