-- Security hardening: close the workspace-takeover chain (audit H7).
--
-- Before: an admin could (a) UPDATE their own membership row to role='owner'
-- (no WITH CHECK re-validated the new row), then (b) DELETE the real owner's
-- membership (the DELETE policy let any owner/admin delete any row). Together
-- that's a full takeover: admin → self-promote to owner → evict the owner.
--
-- After:
--   * UPDATE re-validates the NEW row: you must be owner/admin of the row's
--     (possibly changed) workspace, AND only an owner may write role='owner'.
--     This blocks self-promotion and smuggling a row into another workspace.
--   * DELETE: you can always remove yourself; an OWNER can remove anyone; an
--     ADMIN can remove only plain members (not owners or other admins).
--
-- TEST BEFORE DEPLOY (in a Supabase branch): verify an admin CANNOT set
-- role='owner', CANNOT delete the owner's row, and CAN still manage members;
-- verify an owner can still manage everyone; verify a member can still leave.

-- (a) Member UPDATE — add the missing WITH CHECK.
DROP POLICY IF EXISTS "Owners/admins update members" ON public.workspace_members;
CREATE POLICY "Owners/admins update members"
  ON public.workspace_members FOR UPDATE
  USING (public.current_workspace_role(workspace_id) IN ('owner', 'admin'))
  WITH CHECK (
    public.current_workspace_role(workspace_id) IN ('owner', 'admin')
    AND (
      role <> 'owner'
      OR public.current_workspace_role(workspace_id) = 'owner'
    )
  );

-- (b) Member DELETE — role-aware so admins can't remove owners/admins.
DROP POLICY IF EXISTS "Owners/admins delete members (and members can delete self)" ON public.workspace_members;
CREATE POLICY "Owners/admins delete members (and members can delete self)"
  ON public.workspace_members FOR DELETE
  USING (
    user_id = auth.uid()                                        -- leave yourself
    OR public.current_workspace_role(workspace_id) = 'owner'    -- owner removes anyone
    OR (
      public.current_workspace_role(workspace_id) = 'admin'
      AND role = 'member'                                       -- admin removes members only
    )
  );
