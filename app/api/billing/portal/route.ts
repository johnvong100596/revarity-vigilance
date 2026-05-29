import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isBillingConfigured, stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Open the Stripe Billing Portal so a subscriber can update their card, see
 * invoices, or cancel. Returns the hosted-portal URL for the browser to visit.
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
    const { data: row } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const customerId = row?.stripe_customer_id as string | undefined;
    if (!customerId) {
      return NextResponse.json(
        { error: "No billing account yet." },
        { status: 404 }
      );
    }

    const session = await stripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/app/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[billing/portal]", message);
    return NextResponse.json(
      { error: "Couldn't open billing. Please try again." },
      { status: 500 }
    );
  }
}
