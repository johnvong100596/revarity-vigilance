import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { runHintsEngine } from "@/lib/hints/engine";
import { warmLogos } from "@/lib/institution-logos";
import {
  decryptPlaidToken,
  plaid,
  refreshLiabilitiesForItem,
} from "@/lib/plaid";
import { createClient } from "@/lib/supabase/server";

const SyncInput = z.object({
  plaid_item_row_id: z.string().uuid(),
});

/**
 * Manual refresh trigger for a single Plaid item. Fetches the latest balances
 * from Plaid, updates accounts.balance, and writes a new balance_snapshot
 * row per account. Then re-evaluates hints against the fresh state.
 *
 * (Compare with the webhook handler at /api/plaid/webhook which does the
 * same work but unauthenticated via the admin client.)
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: z.infer<typeof SyncInput>;
  try {
    body = SyncInput.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { data: item } = await supabase
    .from("plaid_items")
    .select("id, workspace_id, access_token_encrypted, institution_id")
    .eq("id", body.plaid_item_row_id)
    .maybeSingle();
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // Home currency drives the fx_rate=1 decision (was hardcoded to USD)
  const { data: profile } = await supabase
    .from("profiles")
    .select("home_currency")
    .eq("id", user.id)
    .single();
  const homeCurrency = (profile?.home_currency as string) ?? "USD";

  try {
    // access_token_encrypted holds a Vault UUID, not the raw token
    const accessToken = await decryptPlaidToken(item.access_token_encrypted);
    const res = await plaid().accountsGet({ access_token: accessToken });
    const now = new Date().toISOString();
    let updated = 0;

    for (const a of res.data.accounts) {
      const balance = Math.abs(a.balances.current ?? 0);
      const creditLimit = a.balances.limit ?? null;

      // Scope by item + workspace + plaid_account (H9 — Plaid account_ids
      // are not globally unique)
      const { data: acct } = await supabase
        .from("accounts")
        .select("id, currency, category, workspace_id")
        .eq("workspace_id", item.workspace_id)
        .eq("plaid_item_id", item.id)
        .eq("plaid_account_id", a.account_id)
        .maybeSingle();
      if (!acct) continue;

      // Refresh balance + credit_limit (Plaid returns the latter only for
      // revolving accounts like credit cards; otherwise it's null).
      await supabase
        .from("accounts")
        .update({
          balance,
          credit_limit: acct.category === "debt" ? creditLimit : null,
          last_balance_updated_at: now,
        })
        .eq("id", acct.id);

      await supabase.from("balance_snapshots").insert({
        user_id: user.id,
        workspace_id: acct.workspace_id,
        account_id: acct.id,
        balance,
        balance_home_currency: balance,
        fx_rate: acct.currency === homeCurrency ? 1 : null,
      });
      updated++;
    }

    // Refresh APR / statement close / payment due / min payment from the
    // Liabilities product — these change rarely but should track over time
    // (e.g., variable-rate APR adjustments, statement-cycle shifts).
    const liabilities = await refreshLiabilitiesForItem({
      accessToken,
      userId: user.id,
      supabase,
    });

    await supabase
      .from("plaid_items")
      .update({ last_sync_at: now })
      .eq("id", item.id);

    // Warm the logo cache off the render path (audit H1) — a manual sync
    // backfills logos for connections made before the bank-icons feature.
    if (item.institution_id) {
      try {
        await warmLogos([item.institution_id as string]);
      } catch (e) {
        console.warn("[plaid/sync] logo warm failed", e);
      }
    }

    await runHintsEngine(user.id, { workspaceId: item.workspace_id });

    return NextResponse.json({ ok: true, updated, liabilities });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[plaid/sync]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
