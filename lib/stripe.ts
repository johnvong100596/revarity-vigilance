import Stripe from "stripe";

/**
 * Server-only Stripe client. NEVER import this into a client component — it
 * reads STRIPE_SECRET_KEY. No network call happens at import time; the client
 * is built lazily on first use.
 *
 * Billing is "fail-soft": before Cena finishes Stripe setup the env vars are
 * unset, so isBillingConfigured() is false and the billing routes return a
 * clean 503 instead of crashing. Nothing here spends money or calls Stripe
 * until a signed-in user actually hits checkout/portal with keys configured.
 */

// Pinned to the API version bundled with the installed SDK (stripe@22).
const API_VERSION = "2026-05-27.dahlia";

let _stripe: Stripe | null = null;

/** True once the secret key AND the operator price are configured. */
export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && operatorPriceId());
}

/** The Stripe price id for the paid operator tier (set in env once created). */
export function operatorPriceId(): string | null {
  return process.env.STRIPE_OPERATOR_PRICE_ID || null;
}

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!_stripe) {
    _stripe = new Stripe(key, { apiVersion: API_VERSION });
  }
  return _stripe;
}
