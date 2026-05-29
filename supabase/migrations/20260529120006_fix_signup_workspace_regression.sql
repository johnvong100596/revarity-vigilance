-- HOTFIX (critical): 20260529120003_revarity_free_operator redefined
-- handle_new_user() starting from the ORIGINAL profiles-only version and
-- accidentally dropped the workspace-creation logic that 20260526120007 had
-- added. Result: new signups got active_workspace_id = NULL → app/app/page.tsx
-- redirects to /login → middleware redirects back to /app → redirect loop.
-- It also dropped referral_token generation.
--
-- This restores BOTH behaviors (workspace + referral_token) AND keeps the
-- @revarity.com comp (is_operator + Personal entity). Then it repairs any
-- accounts created during the broken window.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_workspace_id UUID;
  display_name_value TEXT;
  is_revarity BOOLEAN := (NEW.email ILIKE '%@revarity.com');
BEGIN
  display_name_value := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.email
  );

  INSERT INTO public.profiles (id, display_name, referral_token, is_operator)
  VALUES (
    NEW.id,
    display_name_value,
    encode(gen_random_bytes(8), 'hex'),
    is_revarity
  )
  ON CONFLICT (id) DO NOTHING;

  -- Personal workspace if the user doesn't already own one
  SELECT id INTO new_workspace_id
  FROM public.workspaces
  WHERE owner_user_id = NEW.id
  LIMIT 1;

  IF new_workspace_id IS NULL THEN
    INSERT INTO public.workspaces (name, owner_user_id)
    VALUES ('Personal', NEW.id)
    RETURNING id INTO new_workspace_id;

    INSERT INTO public.workspace_members
      (workspace_id, user_id, invited_email, invite_token, role,
       invited_by_user_id, invited_at, accepted_at)
    VALUES (
      new_workspace_id, NEW.id, COALESCE(NEW.email, ''),
      encode(gen_random_bytes(24), 'hex'), 'owner', NEW.id, NOW(), NOW()
    );
  END IF;

  UPDATE public.profiles
  SET active_workspace_id = new_workspace_id
  WHERE id = NEW.id AND active_workspace_id IS NULL;

  -- @revarity.com: seed the Personal entity for the comped operator tier.
  IF is_revarity THEN
    INSERT INTO public.entities (user_id, name, color_hex, is_personal)
    VALUES (NEW.id, 'Personal', '#1A1A1A', true)
    ON CONFLICT (user_id, name) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Repair users created during the broken window: give any profile without an
-- active workspace a Personal workspace + owner membership.
DO $$
DECLARE
  r RECORD;
  ws_id UUID;
BEGIN
  FOR r IN
    SELECT p.id, u.email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.active_workspace_id IS NULL
  LOOP
    SELECT id INTO ws_id FROM public.workspaces WHERE owner_user_id = r.id LIMIT 1;
    IF ws_id IS NULL THEN
      INSERT INTO public.workspaces (name, owner_user_id)
      VALUES ('Personal', r.id) RETURNING id INTO ws_id;
      INSERT INTO public.workspace_members
        (workspace_id, user_id, invited_email, invite_token, role,
         invited_by_user_id, invited_at, accepted_at)
      VALUES (ws_id, r.id, COALESCE(r.email, ''),
              encode(gen_random_bytes(24), 'hex'), 'owner', r.id, NOW(), NOW())
      ON CONFLICT DO NOTHING;
    END IF;
    UPDATE public.profiles SET active_workspace_id = ws_id
    WHERE id = r.id AND active_workspace_id IS NULL;
  END LOOP;
END $$;

-- Backfill referral_token for anyone the broken window left without one.
UPDATE public.profiles
SET referral_token = encode(gen_random_bytes(8), 'hex')
WHERE referral_token IS NULL;
