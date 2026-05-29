-- HOTFIX (critical): handle_new_user threw at runtime —
--   "function gen_random_bytes(integer) does not exist"
-- gen_random_bytes is pgcrypto, installed in the `extensions` schema, but the
-- trigger pins SET search_path = public so it can't resolve it. (Migrations
-- run by the admin runner DO see extensions, so the backfill succeeded and
-- masked this — but the trigger fails for every real signup → GoTrue returns
-- "Database error creating new user".)
--
-- Fix: generate the random tokens with gen_random_uuid() instead. That's a
-- core function in pg_catalog (always on the search_path regardless of the
-- pin), so it has no extension/search_path dependency. Keeps search_path
-- pinned to public for safety. Token shape: hex from UUIDs (no dashes).

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
    replace(gen_random_uuid()::text, '-', ''),               -- 32 hex chars
    is_revarity
  )
  ON CONFLICT (id) DO NOTHING;

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
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),  -- 64 hex
      'owner', NEW.id, NOW(), NOW()
    );
  END IF;

  UPDATE public.profiles
  SET active_workspace_id = new_workspace_id
  WHERE id = NEW.id AND active_workspace_id IS NULL;

  IF is_revarity THEN
    INSERT INTO public.entities (user_id, name, color_hex, is_personal)
    VALUES (NEW.id, 'Personal', '#1A1A1A', true)
    ON CONFLICT (user_id, name) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
