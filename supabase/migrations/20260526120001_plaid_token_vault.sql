-- Plaid access-token encryption via Supabase Vault.
-- ARCHITECTURE.md §5: "access_token NEVER leaves server. Encrypted at rest
-- via Supabase Vault." Plaid production approval landed 2026-05-26 and
-- this migration is the gate before real bank linking goes live.

CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

-- Wrapper functions exposed in `public` schema, SECURITY DEFINER + executable
-- by service_role only. App code (admin client) calls these RPCs instead of
-- touching the vault schema directly. This keeps the encryption key entirely
-- inside Postgres — the application server never sees it.

CREATE OR REPLACE FUNCTION public.vault_create_secret(
  secret text,
  secret_name text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF secret IS NULL OR length(secret) = 0 THEN
    RAISE EXCEPTION 'secret cannot be empty';
  END IF;
  SELECT vault.create_secret(secret, secret_name, 'Plaid access token') INTO new_id;
  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vault_create_secret(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_create_secret(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.vault_get_secret(
  secret_id uuid
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result text;
BEGIN
  SELECT decrypted_secret INTO result
  FROM vault.decrypted_secrets
  WHERE id = secret_id;
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vault_get_secret(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_get_secret(uuid) TO service_role;

-- Cleanup: existing plaid_items rows are all sandbox test data from day3
-- development. The access_token_encrypted column currently stores plaintext
-- sandbox tokens; going forward it stores Vault UUIDs. Mixing formats would
-- break sync/webhook, so we truncate and let the user re-link from a clean
-- slate against production keys.

UPDATE public.accounts SET archived = TRUE WHERE source = 'plaid';
DELETE FROM public.plaid_items;
