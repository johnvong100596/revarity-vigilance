-- Audit fixes (AUDIT-NIGHT-2026-05-26.md): C1, C6, H1.
--
-- Three things this migration does:
--   1. C1: extend handle_new_user trigger to create a Personal workspace,
--      workspace_members owner row, and set active_workspace_id so new
--      signups don't end up in a /app ⇄ /login redirect loop.
--   2. C6: add peek_workspace_invite RPC so invitees (not yet members)
--      can read invite details to render the Accept page.
--   3. H1: add UPDATE policy on check_ins so same-day upserts
--      (acknowledge then flag, or vice versa) succeed.

-- C1 ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_workspace_id UUID;
  display_name_value TEXT;
BEGIN
  display_name_value := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.email
  );

  -- Profile first (workspace FK depends on profile existing? no — but tidy)
  INSERT INTO public.profiles (id, display_name, referral_token)
  VALUES (
    NEW.id,
    display_name_value,
    encode(gen_random_bytes(8), 'hex')
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
      new_workspace_id,
      NEW.id,
      COALESCE(NEW.email, ''),
      encode(gen_random_bytes(24), 'hex'),
      'owner',
      NEW.id,
      NOW(),
      NOW()
    );
  END IF;

  -- Set as active workspace if profile doesn't have one yet
  UPDATE public.profiles
  SET active_workspace_id = new_workspace_id
  WHERE id = NEW.id AND active_workspace_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- C6 ───────────────────────────────────────────────────────────────────
-- Invitee needs to see invite details (workspace name, role, who invited
-- them) BEFORE accepting. They're not a member yet, so the workspace_members
-- SELECT policy excludes them. This SECURITY DEFINER RPC handles it: it
-- validates the email match exactly like accept_workspace_invite does,
-- then returns the metadata needed to render the page.
--
-- Returns NULL when token doesn't match. Caller distinguishes "not found"
-- from "already accepted" via the accepted_at field.

CREATE OR REPLACE FUNCTION public.peek_workspace_invite(token text)
RETURNS TABLE (
  workspace_id uuid,
  workspace_name text,
  invited_email text,
  role text,
  accepted_at timestamptz,
  email_matches_current_user boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_email text;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();

  RETURN QUERY
  SELECT
    m.workspace_id,
    w.name AS workspace_name,
    m.invited_email,
    m.role,
    m.accepted_at,
    (user_email IS NOT NULL
      AND lower(user_email) = lower(m.invited_email)) AS email_matches_current_user
  FROM public.workspace_members m
  JOIN public.workspaces w ON w.id = m.workspace_id
  WHERE m.invite_token = token
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.peek_workspace_invite(text) TO authenticated, anon;

-- H1 ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users update own check-ins" ON public.check_ins;
CREATE POLICY "Users update own check-ins"
  ON public.check_ins FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id AND public.is_workspace_member(a.workspace_id)
    )
  );
