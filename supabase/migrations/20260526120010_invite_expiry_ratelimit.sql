-- N1 + N2 stretch items (afternoon batch WS2).
--
-- N1: workspace invite tokens never expired — once leaked, valid forever.
-- Add a 7-day expiry, enforce it in accept + peek RPCs.
--
-- N2: /api/plaid/link-token had no rate limit. A lightweight per-user
-- event log lets the route cap requests per hour.

-- ── N1: invite expiry ──────────────────────────────────────────────────

ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;

-- Existing un-accepted invites get a fresh 7-day window from now so we
-- don't instantly invalidate anything in flight. Accepted rows are
-- irrelevant (expiry only gates acceptance).
UPDATE public.workspace_members
SET invite_expires_at = NOW() + INTERVAL '7 days'
WHERE accepted_at IS NULL AND invite_expires_at IS NULL;

-- accept_workspace_invite: add expiry check (between the not-found and
-- already-accepted checks).
CREATE OR REPLACE FUNCTION public.accept_workspace_invite(token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  member RECORD;
  user_email text;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'must be signed in to accept an invite';
  END IF;

  SELECT * INTO member
  FROM public.workspace_members
  WHERE invite_token = token
  LIMIT 1;

  IF member IS NULL THEN
    RAISE EXCEPTION 'invite not found';
  END IF;

  IF member.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite already accepted';
  END IF;

  IF member.invite_expires_at IS NOT NULL
     AND member.invite_expires_at < NOW() THEN
    RAISE EXCEPTION 'invite expired';
  END IF;

  IF lower(member.invited_email) <> lower(user_email) THEN
    RAISE EXCEPTION 'this invite was sent to a different email';
  END IF;

  UPDATE public.workspace_members
  SET user_id = auth.uid(),
      accepted_at = NOW()
  WHERE id = member.id;

  UPDATE public.profiles
  SET active_workspace_id = member.workspace_id
  WHERE id = auth.uid();

  RETURN member.workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(text) TO authenticated;

-- peek_workspace_invite: also return expiry + an is_expired flag so the
-- accept page can render an "expired" state. Return type changes, so the
-- old signature must be dropped before recreating.
DROP FUNCTION IF EXISTS public.peek_workspace_invite(text);
CREATE OR REPLACE FUNCTION public.peek_workspace_invite(token text)
RETURNS TABLE (
  workspace_id uuid,
  workspace_name text,
  invited_email text,
  role text,
  accepted_at timestamptz,
  email_matches_current_user boolean,
  is_expired boolean
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
      AND lower(user_email) = lower(m.invited_email)) AS email_matches_current_user,
    (m.invite_expires_at IS NOT NULL AND m.invite_expires_at < NOW()) AS is_expired
  FROM public.workspace_members m
  JOIN public.workspaces w ON w.id = m.workspace_id
  WHERE m.invite_token = token
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.peek_workspace_invite(text) TO authenticated, anon;

-- ── N2: link-token rate limit log ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plaid_link_token_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plaid_link_token_events_user_time
  ON public.plaid_link_token_events(user_id, created_at DESC);

ALTER TABLE public.plaid_link_token_events ENABLE ROW LEVEL SECURITY;
-- Written + read only via the service-role admin client in the route;
-- no authenticated policies needed (RLS denies by default).
