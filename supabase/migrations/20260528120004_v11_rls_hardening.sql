-- v1.1 audit fixes (AUDIT-VIGILANCE-V11-2026-05-27.md): H-1 + H-2.
-- Two defense-in-depth gaps in tonight's WS1/WS6/WS8 RLS — the UI papers
-- over them today (server actions verify) but RLS alone should also block
-- direct-REST / future-cron / curl-with-JWT misuse.

-- ── H-1: entities — block flipping is_personal=true → false ────────────
--
-- The DELETE policy already excludes is_personal rows, but a user could
-- UPDATE is_personal=false then DELETE. A BEFORE UPDATE trigger pins
-- is_personal so once a row is the user's Personal entity it stays that
-- way (matching the "Default" UX badge). Renaming + recoloring still work.

CREATE OR REPLACE FUNCTION public.pin_entities_is_personal()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_personal IS DISTINCT FROM NEW.is_personal THEN
    RAISE EXCEPTION 'entities.is_personal is immutable once set';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pin_entities_is_personal ON public.entities;
CREATE TRIGGER pin_entities_is_personal
  BEFORE UPDATE ON public.entities
  FOR EACH ROW EXECUTE FUNCTION public.pin_entities_is_personal();

-- ── H-2: ious + inter_entity_flows — entity references must belong to ──
--        the caller, not just match user_id on the row itself.

-- ious: when entity_id is set, it must belong to the caller. user_id check
-- stays the same.
DROP POLICY IF EXISTS "Users insert own ious" ON public.ious;
CREATE POLICY "Users insert own ious"
  ON public.ious FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      entity_id IS NULL
      OR entity_id IN (
        SELECT id FROM public.entities WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users update own ious" ON public.ious;
CREATE POLICY "Users update own ious"
  ON public.ious FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      entity_id IS NULL
      OR entity_id IN (
        SELECT id FROM public.entities WHERE user_id = auth.uid()
      )
    )
  );

-- inter_entity_flows: BOTH endpoints must be the caller's own entities.
DROP POLICY IF EXISTS "Users insert own flows" ON public.inter_entity_flows;
CREATE POLICY "Users insert own flows"
  ON public.inter_entity_flows FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND from_entity_id IN (
      SELECT id FROM public.entities WHERE user_id = auth.uid()
    )
    AND to_entity_id IN (
      SELECT id FROM public.entities WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users update own flows" ON public.inter_entity_flows;
CREATE POLICY "Users update own flows"
  ON public.inter_entity_flows FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND from_entity_id IN (
      SELECT id FROM public.entities WHERE user_id = auth.uid()
    )
    AND to_entity_id IN (
      SELECT id FROM public.entities WHERE user_id = auth.uid()
    )
  );
