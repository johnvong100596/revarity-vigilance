import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { runHintsEngine } from "@/lib/hints/engine";
import { plaid } from "@/lib/plaid";
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
    .select("id, access_token_encrypted")
    .eq("id", body.plaid_item_row_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  try {
    const res = await plaid().accountsGet({ access_token: item.access_token_encrypted });
    const now = new Date().toISOString();
    let updated = 0;

    for (const a of res.data.accounts) {
      const balance = Math.abs(a.balances.current ?? 0);

      const { data: acct } = await supabase
        .from("accounts")
        .select("id, currency")
        .eq("user_id", user.id)
        .eq("plaid_account_id", a.account_id)
        .maybeSingle();
      if (!acct) continue;

      await supabase
        .from("accounts")
        .update({ balance, last_balance_updated_at: now })
        .eq("id", acct.id);

      await supabase.from("balance_snapshots").insert({
        user_id: user.id,
        account_id: acct.id,
        balance,
        balance_home_currency: balance,
        fx_rate: acct.currency === "USD" ? 1 : null,
      });
      updated++;
    }

    await supabase
      .from("plaid_items")
      .update({ last_sync_at: now })
      .eq("id", item.id);

    await runHintsEngine(user.id);

    return NextResponse.json({ ok: true, updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[plaid/sync]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
