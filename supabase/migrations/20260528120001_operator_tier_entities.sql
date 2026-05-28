-- v1.1 WS1: Operator Tier toggle + Entities.
--
-- Most users (90%) never see operator features — the toggle stays OFF and
-- multi-entity tagging / IOU ledger / cash runway / cross-entity flow are
-- entirely hidden. Operators flip is_operator=true in Settings and the
-- advanced surfaces appear.
--
-- Entities are user-scoped (not workspace-scoped): a user's "businesses"
-- are their own taxonomy across whichever workspaces they belong to.
-- Every operator user is auto-seeded a "Personal" entity (immutable name,
-- not deletable) so tagging always has a default home.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_operator BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color_hex TEXT NOT NULL DEFAULT '#F04E37',
  icon TEXT,
  is_personal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT entities_name_per_user_unique UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_entities_user ON public.entities(user_id);

ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own entities" ON public.entities;
CREATE POLICY "Users read own entities"
  ON public.entities FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own entities" ON public.entities;
CREATE POLICY "Users insert own entities"
  ON public.entities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own entities" ON public.entities;
CREATE POLICY "Users update own entities"
  ON public.entities FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own entities" ON public.entities;
CREATE POLICY "Users delete own entities"
  ON public.entities FOR DELETE
  USING (auth.uid() = user_id AND is_personal = false);
-- The "Personal" entity is undeleteable by RLS — UI must enforce too.

CREATE TRIGGER set_entities_updated_at
  BEFORE UPDATE ON public.entities
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Tag accounts by entity (nullable — only operators set this; non-operators
-- ignore the column entirely).
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS entity_id UUID
    REFERENCES public.entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_entity
  ON public.accounts(entity_id) WHERE entity_id IS NOT NULL;
