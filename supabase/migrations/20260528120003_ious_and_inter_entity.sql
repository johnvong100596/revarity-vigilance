-- v1.1 WS6 + WS8: IOU ledger + cross-entity money flow (Tier 2, operator).
--
-- ious: an informal-debt ledger. The Excel analysis showed Cena tracks
-- ~$1.25M across family/friends/lenders. Each row is a single obligation
-- in one direction; the user logs both sides ("I owe Mom $5K", "Vu owes
-- me $12K") and settles them when the money moves.
--
-- inter_entity_flows: money the user moves between their OWN businesses
-- ("John lent $12K to Revarity"). Settled flows update both entities'
-- net worth views simultaneously.

CREATE TABLE IF NOT EXISTS public.ious (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  counterparty_name TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  direction TEXT NOT NULL CHECK (direction IN ('owed_to_me', 'i_owe')),
  due_date DATE,
  recurring JSONB, -- e.g. {"frequency":"monthly","day_of_month":15}
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'settled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ious_user_status
  ON public.ious(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ious_entity
  ON public.ious(entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ious_due_date
  ON public.ious(user_id, due_date)
  WHERE status = 'active' AND due_date IS NOT NULL;

ALTER TABLE public.ious ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own ious" ON public.ious;
CREATE POLICY "Users read own ious"
  ON public.ious FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own ious" ON public.ious;
CREATE POLICY "Users insert own ious"
  ON public.ious FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own ious" ON public.ious;
CREATE POLICY "Users update own ious"
  ON public.ious FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own ious" ON public.ious;
CREATE POLICY "Users delete own ious"
  ON public.ious FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_ious_updated_at
  BEFORE UPDATE ON public.ious
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Inter-entity flows (WS8) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inter_entity_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  to_entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  purpose TEXT,
  flow_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'settled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  CONSTRAINT inter_entity_flow_different_entities
    CHECK (from_entity_id <> to_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_inter_entity_flows_user
  ON public.inter_entity_flows(user_id, status);

ALTER TABLE public.inter_entity_flows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own flows" ON public.inter_entity_flows;
CREATE POLICY "Users read own flows"
  ON public.inter_entity_flows FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own flows" ON public.inter_entity_flows;
CREATE POLICY "Users insert own flows"
  ON public.inter_entity_flows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own flows" ON public.inter_entity_flows;
CREATE POLICY "Users update own flows"
  ON public.inter_entity_flows FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own flows" ON public.inter_entity_flows;
CREATE POLICY "Users delete own flows"
  ON public.inter_entity_flows FOR DELETE
  USING (auth.uid() = user_id);
