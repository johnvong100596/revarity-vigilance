import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve the current user's active workspace id. Called by every server
 * page + server action that touches workspace-scoped data so queries
 * explicitly filter by the active workspace (RLS-membership covers
 * authorization, but a user may belong to multiple workspaces; the
 * explicit filter scopes to the one they're currently "in").
 *
 * Throws if no profile/active workspace exists (which should be impossible
 * once the auto-create-profile trigger has run; signals a corrupt state).
 */
export async function getActiveWorkspaceId(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .single();

  if (error || !data?.active_workspace_id) {
    throw new Error(
      `No active workspace for user ${userId} (${error?.message ?? "no profile row"})`
    );
  }

  return data.active_workspace_id as string;
}

/**
 * Resolve the workspace_id from an account, used by the Plaid webhook
 * which doesn't have a user context. Caller is responsible for ensuring
 * they've validated the request authentically before calling.
 */
export async function getWorkspaceIdForAccount(
  supabase: SupabaseClient,
  accountId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("accounts")
    .select("workspace_id")
    .eq("id", accountId)
    .maybeSingle();
  return (data?.workspace_id as string | undefined) ?? null;
}

/**
 * Resolve the workspace_id from a plaid_items row (by Plaid's external
 * item_id, not our DB pk). Used by the webhook handler.
 */
export async function getWorkspaceIdForPlaidItem(
  supabase: SupabaseClient,
  plaidItemRowId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("plaid_items")
    .select("workspace_id")
    .eq("id", plaidItemRowId)
    .maybeSingle();
  return (data?.workspace_id as string | undefined) ?? null;
}
