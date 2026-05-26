import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side admin client using the service_role key. Bypasses RLS — only
 * call this from trusted server code (API routes verifying their own
 * authenticity, like Plaid webhooks). NEVER import this into a client
 * component or expose the key to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "createAdminClient missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
