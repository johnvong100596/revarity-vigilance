-- Multi-user workspaces. Each user gets a "Personal" workspace at signup;
-- they can also belong to additional workspaces (e.g., Revarity team).
--
-- Scope split:
--   workspace-scoped tables (data shared with all members):
--     accounts, plaid_items, balance_snapshots, hints
--   user-scoped within workspace (personal regardless of membership):
--     check_ins, weekly_reflections, monthly_closes, awareness_streak
--   global (no workspace at all):
--     bank_products, fx_rates
--
-- RLS rewrite happens at the bottom — every workspace-scoped policy gets
-- replaced; user-scoped policies stay but gain a "account is in your
-- workspace" cross-check where applicable.

-- 1. Tables ────────────────────────────────────────────────────────────

CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workspaces_owner ON public.workspaces(owner_user_id);

CREATE TRIGGER set_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invite_token TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  CONSTRAINT workspace_members_role_check
    CHECK (role IN ('owner', 'admin', 'member')),
  UNIQUE(workspace_id, invited_email)
);

CREATE INDEX idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user ON public.workspace_members(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_workspace_members_token ON public.workspace_members(invite_token);

-- 2. Helper function used by every RLS policy ──────────────────────────
-- STABLE + SECURITY DEFINER so RLS recursion doesn't fire and the function
-- itself is callable from inside policies.

CREATE OR REPLACE FUNCTION public.current_workspace_role(ws_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = ws_id
    AND user_id = auth.uid()
    AND accepted_at IS NOT NULL
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND accepted_at IS NOT NULL
  )
$$;

GRANT EXECUTE ON FUNCTION public.current_workspace_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated;

-- 3. profiles.active_workspace_id ──────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN active_workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- 4. Backfill — give every existing user a Personal workspace and set as
--    active. Has to happen BEFORE the workspace_id NOT NULL constraints
--    below, otherwise the constraint fires on the empty initial rows.

INSERT INTO public.workspaces (id, name, owner_user_id)
SELECT gen_random_uuid(), 'Personal', u.id
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspaces w WHERE w.owner_user_id = u.id
);

INSERT INTO public.workspace_members
  (workspace_id, user_id, invited_email, invite_token, role,
   invited_by_user_id, invited_at, accepted_at)
SELECT
  w.id,
  u.id,
  COALESCE(u.email, ''),
  encode(gen_random_bytes(24), 'hex'),
  'owner',
  u.id,
  NOW(),
  NOW()
FROM public.workspaces w
JOIN auth.users u ON u.id = w.owner_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_members m
  WHERE m.workspace_id = w.id AND m.user_id = u.id
);

UPDATE public.profiles p
SET active_workspace_id = w.id
FROM public.workspaces w
WHERE w.owner_user_id = p.id
  AND p.active_workspace_id IS NULL;

-- 5. workspace_id on the account-scoped tables ─────────────────────────

ALTER TABLE public.accounts
  ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.plaid_items
  ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.balance_snapshots
  ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.hints
  ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Backfill: existing rows go into the owner's personal workspace
UPDATE public.accounts a
  SET workspace_id = w.id
  FROM public.workspaces w
  WHERE w.owner_user_id = a.user_id AND a.workspace_id IS NULL;

UPDATE public.plaid_items pi
  SET workspace_id = w.id
  FROM public.workspaces w
  WHERE w.owner_user_id = pi.user_id AND pi.workspace_id IS NULL;

UPDATE public.balance_snapshots bs
  SET workspace_id = w.id
  FROM public.workspaces w
  WHERE w.owner_user_id = bs.user_id AND bs.workspace_id IS NULL;

UPDATE public.hints h
  SET workspace_id = w.id
  FROM public.workspaces w
  WHERE w.owner_user_id = h.user_id AND h.workspace_id IS NULL;

-- Enforce NOT NULL now that backfill is done
ALTER TABLE public.accounts ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.plaid_items ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.balance_snapshots ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.hints ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX idx_accounts_workspace ON public.accounts(workspace_id);
CREATE INDEX idx_plaid_items_workspace ON public.plaid_items(workspace_id);
CREATE INDEX idx_balance_snapshots_workspace ON public.balance_snapshots(workspace_id);
CREATE INDEX idx_hints_workspace ON public.hints(workspace_id);

-- 6. RLS on the new tables ─────────────────────────────────────────────

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own workspaces"
  ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(id));

CREATE POLICY "Owners update their workspaces"
  ON public.workspaces FOR UPDATE
  USING (public.current_workspace_role(id) = 'owner');

CREATE POLICY "Authed users create workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Owners delete their workspaces"
  ON public.workspaces FOR DELETE
  USING (public.current_workspace_role(id) = 'owner');

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read membership for workspaces they belong to"
  ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Owners/admins insert members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (public.current_workspace_role(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "Owners/admins update members"
  ON public.workspace_members FOR UPDATE
  USING (public.current_workspace_role(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "Owners/admins delete members (and members can delete self)"
  ON public.workspace_members FOR DELETE
  USING (
    public.current_workspace_role(workspace_id) IN ('owner', 'admin')
    OR user_id = auth.uid()
  );

-- Accepting an invite is a separate path that needs to bypass RLS on insert
-- (the invitee doesn't yet have membership when they accept). Handled via
-- a SECURITY DEFINER server function (see acceptInvite in server actions).

-- 7. Rewrite RLS on existing account-scoped tables ─────────────────────
-- Drop the old user_id-based policies and replace with workspace-scoped.

-- accounts
DROP POLICY IF EXISTS "Users read own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users insert own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users update own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users delete own accounts" ON public.accounts;

CREATE POLICY "Members read workspace accounts"
  ON public.accounts FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Owners/admins insert workspace accounts"
  ON public.accounts FOR INSERT
  WITH CHECK (public.current_workspace_role(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "Owners/admins update workspace accounts"
  ON public.accounts FOR UPDATE
  USING (public.current_workspace_role(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "Owners/admins delete workspace accounts"
  ON public.accounts FOR DELETE
  USING (public.current_workspace_role(workspace_id) IN ('owner', 'admin'));

-- plaid_items
DROP POLICY IF EXISTS "Users read own plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Users insert own plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Users update own plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Users delete own plaid items" ON public.plaid_items;

CREATE POLICY "Members read workspace plaid items"
  ON public.plaid_items FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Owners/admins insert workspace plaid items"
  ON public.plaid_items FOR INSERT
  WITH CHECK (public.current_workspace_role(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "Owners/admins update workspace plaid items"
  ON public.plaid_items FOR UPDATE
  USING (public.current_workspace_role(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "Owners/admins delete workspace plaid items"
  ON public.plaid_items FOR DELETE
  USING (public.current_workspace_role(workspace_id) IN ('owner', 'admin'));

-- balance_snapshots (read by members, written by any signed-in user with
-- workspace membership — the sync job runs as the user)
DROP POLICY IF EXISTS "Users read own snapshots" ON public.balance_snapshots;
DROP POLICY IF EXISTS "Users insert own snapshots" ON public.balance_snapshots;

CREATE POLICY "Members read workspace snapshots"
  ON public.balance_snapshots FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members insert workspace snapshots"
  ON public.balance_snapshots FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id));

-- hints
DROP POLICY IF EXISTS "Users read own hints" ON public.hints;
DROP POLICY IF EXISTS "Users insert own hints" ON public.hints;
DROP POLICY IF EXISTS "Users update own hints" ON public.hints;

CREATE POLICY "Members read workspace hints"
  ON public.hints FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members insert workspace hints"
  ON public.hints FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members update workspace hints"
  ON public.hints FOR UPDATE
  USING (public.is_workspace_member(workspace_id));

-- 8. user-scoped tables stay tied to auth.uid() but get a workspace check
--    via account_id where applicable (check_ins references account_id which
--    is now workspace-scoped). weekly_reflections + monthly_closes are pure
--    journal data; keep them as-is, scoped to user only.

DROP POLICY IF EXISTS "Users read own check-ins" ON public.check_ins;
DROP POLICY IF EXISTS "Users insert own check-ins" ON public.check_ins;

CREATE POLICY "Users read own check-ins for workspace accounts"
  ON public.check_ins FOR SELECT
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id AND public.is_workspace_member(a.workspace_id)
    )
  );

CREATE POLICY "Users insert own check-ins for workspace accounts"
  ON public.check_ins FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id AND public.is_workspace_member(a.workspace_id)
    )
  );

-- weekly_reflections + monthly_closes stay unchanged (auth.uid() = user_id).

-- 9. accept-invite helper — SECURITY DEFINER so RLS doesn't block the
--    invitee inserting their own user_id into the row that matches their
--    invite_token. Validates email match and token correctness before
--    updating.

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

  IF lower(member.invited_email) <> lower(user_email) THEN
    RAISE EXCEPTION 'this invite was sent to a different email';
  END IF;

  UPDATE public.workspace_members
  SET user_id = auth.uid(),
      accepted_at = NOW()
  WHERE id = member.id;

  -- Mark the new workspace as the user's active one so they land in it
  UPDATE public.profiles
  SET active_workspace_id = member.workspace_id
  WHERE id = auth.uid();

  RETURN member.workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(text) TO authenticated;
