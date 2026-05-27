import { NextResponse } from "next/server";

import { LINK_COUNTRY_CODES, LINK_PRODUCTS, plaid } from "@/lib/plaid";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// N2: cap link-token creation per user per hour. Auth-gated already, but a
// logged-in user shouldn't be able to spam Plaid Link quota.
const LINK_TOKENS_PER_HOUR = 15;

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Rate-limit check via the service-role event log (RLS-protected table)
  const admin = createAdminClient();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentTokens } = await admin
    .from("plaid_link_token_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", hourAgo);
  if ((recentTokens ?? 0) >= LINK_TOKENS_PER_HOUR) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a little while." },
      { status: 429 }
    );
  }

  try {
    const webhookUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/plaid/webhook`
      : "https://vigilance.revarity.com/api/plaid/webhook";

    const response = await plaid().linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: "Vigilance",
      products: LINK_PRODUCTS,
      country_codes: LINK_COUNTRY_CODES,
      language: "en",
      webhook: webhookUrl,
    });

    // Log the successful issue for rate-limit accounting
    await admin
      .from("plaid_link_token_events")
      .insert({ user_id: user.id });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[plaid/link-token]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
