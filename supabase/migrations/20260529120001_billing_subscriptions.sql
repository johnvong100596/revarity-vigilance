-- SaaS billing (#2): Stripe subscriptions + the operator-tier entitlement bridge.
--
-- DESIGN: `subscriptions` is the billing record-of-truth. The Stripe webhook
-- (service_role) keeps profiles.is_operator in sync with subscription status,
-- so EVERY existing operator gate (app/app/ious, hints engine, H-307,
-- settings, accounts UI) respects billing with ZERO gate-code changes.
--
-- BACKWARD-COMPAT: a manually-granted is_operator (a comped account) that has
-- NO subscription row is left untouched — the webhook only flips the flag for
-- users who actually have a subscription. So Cena can still comp accounts by
-- hand and they keep operator access. See lib/entitlements.ts for how reads
-- resolve "paid sub" vs "comp" vs "free".
--
-- NOTE: writes to both tables are service-role only (checkout route + webhook,
-- which use the admin client and bypass RLS). Users get SELECT on their own
-- rows so the Settings page can show plan status. No user INSERT/UPDATE/DELETE
-- policy is intentional.

-- Map a Supabase user to their Stripe customer (1:1).
CREATE TABLE IF NOT EXISTS public.stripe_customers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own stripe customer" ON public.stripe_customers;
CREATE POLICY "Users read own stripe customer"
  ON public.stripe_customers FOR SELECT
  USING (auth.uid() = user_id);
-- (no write policy — only the service_role checkout route inserts here)

-- One row per Stripe subscription. We keep the latest state Stripe sends us.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT,
  -- Stripe status: trialing|active|past_due|canceled|unpaid|incomplete|
  -- incomplete_expired|paused. Stored verbatim; entitlement logic lives in
  -- lib/entitlements.ts so the rule is in one place.
  status TEXT NOT NULL,
  -- Which entitlement this subscription grants. Only 'operator' today; column
  -- exists so a second paid plan doesn't need a schema change.
  plan TEXT NOT NULL DEFAULT 'operator',
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own subscriptions" ON public.subscriptions;
CREATE POLICY "Users read own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);
-- (no write policy — only the service_role webhook upserts here)

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
