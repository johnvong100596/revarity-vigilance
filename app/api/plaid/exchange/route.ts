import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { runHintsEngine } from "@/lib/hints/engine";
import {
  mapPlaidAccountType,
  mapPlaidCategory,
  plaid,
} from "@/lib/plaid";
import { createClient } from "@/lib/supabase/server";

const ExchangeInput = z.object({
  public_token: z.string().min(1),
  metadata: z.unknown().optional(),
});

interface PlaidLinkMetadata {
  institution?: { name?: string; institution_id?: string };
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: z.infer<typeof ExchangeInput>;
  try {
    body = ExchangeInput.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const metadata = (body.metadata ?? {}) as PlaidLinkMetadata;
  const institutionName = metadata.institution?.name ?? null;
  const institutionId = metadata.institution?.institution_id ?? null;

  try {
    // 1. Exchange public token for the long-lived access token
    const exchange = await plaid().itemPublicTokenExchange({
      public_token: body.public_token,
    });
    const accessToken = exchange.data.access_token;
    const plaidItemId = exchange.data.item_id;

    // 2. Store the plaid_item row.
    // SECURITY TODO: encrypt access_token via Supabase Vault before
    // shipping to production. For sandbox the token is non-sensitive
    // (no real bank credentials), so plaintext storage is acceptable.
    const { data: plaidItem, error: itemErr } = await supabase
      .from("plaid_items")
      .insert({
        user_id: user.id,
        plaid_item_id: plaidItemId,
        access_token_encrypted: accessToken,
        institution_name: institutionName,
        institution_id: institutionId,
        status: "active",
        last_sync_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (itemErr || !plaidItem) {
      console.error("[plaid/exchange] insert plaid_item", itemErr);
      return NextResponse.json(
        { error: itemErr?.message ?? "Failed to store item" },
        { status: 500 }
      );
    }

    // 3. Fetch accounts from Plaid
    const accountsRes = await plaid().accountsGet({ access_token: accessToken });
    const plaidAccounts = accountsRes.data.accounts;

    if (plaidAccounts.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // 4. Convert Plaid accounts to our schema and insert
    const now = new Date().toISOString();
    const rows = plaidAccounts.map((a, idx) => {
      const plaidType = a.type;
      const balance = Math.abs(a.balances.current ?? 0);
      const subtypeLabel = a.subtype
        ? a.subtype.charAt(0).toUpperCase() + a.subtype.slice(1)
        : null;
      return {
        user_id: user.id,
        name: a.name || a.official_name || "Account",
        subtitle: subtypeLabel,
        account_type: mapPlaidAccountType(plaidType),
        category: mapPlaidCategory(plaidType),
        balance,
        currency: a.balances.iso_currency_code || "USD",
        credit_limit: a.balances.limit ?? null,
        source: "plaid",
        plaid_account_id: a.account_id,
        plaid_item_id: plaidItem.id,
        position: idx,
        last_balance_updated_at: now,
      };
    });

    const { data: insertedAccounts, error: accountsErr } = await supabase
      .from("accounts")
      .insert(rows)
      .select("id, balance, currency");
    if (accountsErr || !insertedAccounts) {
      console.error("[plaid/exchange] insert accounts", accountsErr);
      return NextResponse.json(
        { error: accountsErr?.message ?? "Failed to create accounts" },
        { status: 500 }
      );
    }

    // 5. Seed an initial balance_snapshot for each
    const snapshots = insertedAccounts.map((acct) => ({
      user_id: user.id,
      account_id: acct.id,
      balance: acct.balance,
      balance_home_currency: acct.balance,
      fx_rate: acct.currency === "USD" ? 1 : null,
    }));
    await supabase.from("balance_snapshots").insert(snapshots);

    // 6. Run hint evaluation now that new accounts exist
    await runHintsEngine(user.id);

    return NextResponse.json({
      success: true,
      count: insertedAccounts.length,
      institution: institutionName,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[plaid/exchange]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
