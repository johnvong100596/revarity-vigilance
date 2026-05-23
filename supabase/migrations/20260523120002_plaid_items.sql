-- Plaid Items: one per connected institution. access_token is encrypted via
-- Supabase Vault in app code (server-side only — never exposed to client).
-- ARCHITECTURE.md §3 + §5.

CREATE TABLE public.plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_item_id TEXT NOT NULL UNIQUE,
  access_token_encrypted TEXT NOT NULL,
  institution_name TEXT,
  institution_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT plaid_items_status_check CHECK (status IN ('active','disconnected','error'))
);

CREATE INDEX idx_plaid_items_user ON public.plaid_items(user_id);

ALTER TABLE public.plaid_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own plaid items"
  ON public.plaid_items FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own plaid items"
  ON public.plaid_items FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own plaid items"
  ON public.plaid_items FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users delete own plaid items"
  ON public.plaid_items FOR DELETE USING (auth.uid() = user_id);
