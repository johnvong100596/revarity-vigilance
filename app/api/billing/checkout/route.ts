import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isBillingConfigured, operatorPriceId, stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Start a Stripe Checkout session for the paid operator tier and return its
 * hosted-page URL. The client redirects the browser to that URL.
 *
 * No-ops cleanly (503) until billing env vars are set, so this never crashes a
 * build or an un-configured environment.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!isBillingConfigured()) {
    return NextResponse.json(
      { error: "Billing isn't set up yet." },
      { status: 503 }
    );
  }

  const origin = req.nextUrl.origin;

  try {
    // Reuse this user's Stripe customer if we already made one, else create it.
    const { data: existing } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id as string | undefined;

    if (!customerId) {
      const customer = await stripe().customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      // Persist the mapping with the admin client — there's no user INSERT
      // policy on stripe_customers (writes are service-role only).
      const admin = createAdminClient();
      const { error: insErr } = await admin
        .from("stripe_customers")
        .insert({ user_id: user.id, stripe_customer_id: customerId });
      if (insErr) {
        if (insErr.code === "23505") {
          // A concurrent checkout inserted first. Use THEIR customer id (the
          // one persisted), not our just-created orphan, so the persisted
          // mapping and the billed customer stay consistent.
          const { data: winner } = await admin
            .from("stripe_customers")
            .select("stripe_customer_id")
            .eq("user_id", user.id)
            .single();
          if (winner?.stripe_customer_id) {
            customerId = winner.stripe_customer_id as string;
          }
        } else {
          throw new Error(`customer mapping failed: ${insErr.message}`);
        }
      }
    }

    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: operatorPriceId()!, quantity: 1 }],
      client_reference_id: user.id,
      subscription_data: {
        // 30-day free trial for everyone who checks out. (@revarity.com staff
        // are comped and never reach checkout.) During the trial the
        // subscription status is "trialing", which lib/entitlements.ts treats
        // as entitled, and the webhook sets is_operator on.
        trial_period_days: 30,
        metadata: { supabase_user_id: user.id },
      },
      allow_promotion_codes: true,
      success_url: `${origin}/app/settings?billing=success`,
      cancel_url: `${origin}/app/settings?billing=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[billing/checkout]", message);
    return NextResponse.json(
      { error: "Couldn't start checkout. Please try again." },
      { status: 500 }
    );
  }
}
