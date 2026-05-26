import { NextResponse } from "next/server";

import { LINK_COUNTRY_CODES, LINK_PRODUCTS, plaid } from "@/lib/plaid";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[plaid/link-token]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
