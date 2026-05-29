-- Free business-owner tier for Revarity staff (per Cena): anyone with an
-- @revarity.com email gets the business-owner ("operator") features free —
-- comped, no trial, no billing. Everyone else gets a 30-day trial via Stripe
-- checkout (trial_period_days on the checkout session) and then pays.
--
-- Implementation: @revarity.com users are auto-set is_operator = true (the flag
-- every operator gate already reads), and seeded the immutable "Personal"
-- entity so tagging has a default home — exactly what setOperator() / the Stripe
-- webhook do. This makes the comp authoritative at the data layer.
--
-- A comped revarity user with NO subscription is therefore "operator/comp" in
-- lib/entitlements.ts; the Stripe webhook never runs for them, so it never
-- turns the flag off.

-- 1. New @revarity.com signups: grant operator on profile creation + seed
--    Personal. Extends the existing handle_new_user trigger function.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  is_revarity BOOLEAN := (NEW.email ILIKE '%@revarity.com');
BEGIN
  INSERT INTO public.profiles (id, display_name, is_operator)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    is_revarity
  )
  ON CONFLICT (id) DO NOTHING;

  IF is_revarity THEN
    INSERT INTO public.entities (user_id, name, color_hex, is_personal)
    VALUES (NEW.id, 'Personal', '#1A1A1A', true)
    ON CONFLICT (user_id, name) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Backfill existing @revarity.com users.
UPDATE public.profiles p
SET is_operator = true
FROM auth.users u
WHERE p.id = u.id
  AND u.email ILIKE '%@revarity.com'
  AND p.is_operator = false;

INSERT INTO public.entities (user_id, name, color_hex, is_personal)
SELECT u.id, 'Personal', '#1A1A1A', true
FROM auth.users u
WHERE u.email ILIKE '%@revarity.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.entities e WHERE e.user_id = u.id
  )
ON CONFLICT (user_id, name) DO NOTHING;
