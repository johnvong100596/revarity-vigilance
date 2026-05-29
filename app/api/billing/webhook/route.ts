import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { isBillingConfigured, stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Keeps our `subscriptions` table and the operator entitlement
 * (profiles.is_operator) in sync with Stripe. This is the bridge that makes the
 * existing is_operator gates respect billing without touching any gate code.
 *
 * Idempotent: every handler is an upsert keyed by stripe_subscription_id and a
 * flag write that's the same on retry, so Stripe re-deliveries are safe.
 *
 * On a genuine processing error we return 500 so Stripe retries; we only return
 * 2xx for events we handled or intentionally ignore.
 */

const ACTIVE_STATUSES = new Set(["trialing", "active", "past_due"]);

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!isBillingConfigured() || !webhookSecret) {
    return NextResponse.json(
      { error: "Billing isn't set up yet." },
      { status: 503 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Raw body is required for signature verification — do not parse as JSON.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "bad signature";
    console.error("[billing/webhook] signature verify failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case "checkout.session.completed": {
        // The subscription.* events carry the entitlement; here we just make
        // sure the customer→user mapping exists (covers a raced insert).
        await backfillCustomerMapping(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      }
      default:
        // Ignore everything else.
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "handler failed";
    console.error(`[billing/webhook] ${event.type} failed:`, message);
    // 500 so Stripe retries; our handlers are idempotent.
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** Defensive read of the fields we need (shape varies across API versions). */
function readSubFields(sub: Stripe.Subscription) {
  const raw = sub as unknown as {
    id: string;
    status: string;
    customer: string | { id: string };
    cancel_at_period_end?: boolean;
    current_period_end?: number;
    metadata?: Record<string, string> | null;
    items?: {
      data?: Array<{
        price?: { id?: string };
        current_period_end?: number;
      }>;
    };
  };
  const item = raw.items?.data?.[0];
  const periodEnd = raw.current_period_end ?? item?.current_period_end ?? null;
  return {
    subscriptionId: raw.id,
    status: raw.status,
    customerId: typeof raw.customer === "string" ? raw.customer : raw.customer?.id,
    priceId: item?.price?.id ?? null,
    cancelAtPeriodEnd: Boolean(raw.cancel_at_period_end),
    currentPeriodEndISO:
      typeof periodEnd === "number"
        ? new Date(periodEnd * 1000).toISOString()
        : null,
    metadataUserId: raw.metadata?.supabase_user_id ?? null,
  };
}

async function resolveUserId(
  admin: ReturnType<typeof createAdminClient>,
  metadataUserId: string | null,
  customerId: string | undefined
): Promise<string | null> {
  if (metadataUserId) return metadataUserId;
  if (!customerId) return null;
  const { data } = await admin
    .from("stripe_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

async function syncSubscription(sub: Stripe.Subscription) {
  const f = readSubFields(sub);
  const admin = createAdminClient();

  const userId = await resolveUserId(admin, f.metadataUserId, f.customerId);
  if (!userId) {
    // Can't attribute this subscription to a user — make Stripe retry; the
    // checkout.session.completed event usually lands the mapping first.
    throw new Error(
      `no user for subscription ${f.subscriptionId} (customer ${f.customerId})`
    );
  }

  const { error: upsertErr } = await admin
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_subscription_id: f.subscriptionId,
        stripe_price_id: f.priceId,
        status: f.status,
        plan: "operator",
        current_period_end: f.currentPeriodEndISO,
        cancel_at_period_end: f.cancelAtPeriodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" }
    );
  if (upsertErr) {
    throw new Error(`subscription upsert failed: ${upsertErr.message}`);
  }

  // Bridge to the existing gates: paid/active → operator on, else off.
  const entitled = ACTIVE_STATUSES.has(f.status);
  const { error: flagErr } = await admin
    .from("profiles")
    .update({ is_operator: entitled })
    .eq("id", userId);
  if (flagErr) {
    throw new Error(`is_operator sync failed: ${flagErr.message}`);
  }

  // Mirror setOperator(): first time on, seed the immutable Personal entity so
  // entity tagging always has a default home.
  if (entitled) {
    const { count } = await admin
      .from("entities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) === 0) {
      const { error: seedErr } = await admin.from("entities").insert({
        user_id: userId,
        name: "Personal",
        color_hex: "#1A1A1A",
        is_personal: true,
      });
      // 23505 = the (user_id, name) unique constraint catching a concurrent
      // seed; that's the race resolving correctly, not a failure.
      if (seedErr && seedErr.code !== "23505") {
        throw new Error(`personal entity seed failed: ${seedErr.message}`);
      }
    }
  }
}

async function backfillCustomerMapping(session: Stripe.Checkout.Session) {
  const userId =
    session.client_reference_id ||
    (session.metadata?.supabase_user_id ?? null);
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  if (!userId || !customerId) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("stripe_customers")
    .upsert(
      { user_id: userId, stripe_customer_id: customerId },
      { onConflict: "user_id" }
    );
  if (error) {
    throw new Error(`customer mapping backfill failed: ${error.message}`);
  }
}
