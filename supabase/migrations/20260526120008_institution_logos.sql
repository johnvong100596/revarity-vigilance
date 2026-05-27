-- Bank icons feature (afternoon batch WS1).
--
-- institution_logos: a global, institution-level cache of Plaid logos +
-- brand colors. Not workspace-scoped — logos are public institution
-- metadata shared across all users. Keyed by Plaid's institution_id.
--
-- Writes happen via the service-role admin client (server-side logo
-- fetch), so we only need a SELECT policy for authenticated users; the
-- admin client bypasses RLS for upserts.

CREATE TABLE IF NOT EXISTS public.institution_logos (
  institution_id TEXT PRIMARY KEY,
  name TEXT,
  logo_base64 TEXT,          -- base64 PNG from Plaid (no data: prefix)
  color_primary TEXT,        -- hex like "#EC111A", may be null
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.institution_logos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read institution logos" ON public.institution_logos;
CREATE POLICY "Authenticated read institution logos"
  ON public.institution_logos FOR SELECT
  TO authenticated
  USING (true);

-- accounts.institution_id — denormalized convenience column so the home
-- page can resolve a logo without joining through plaid_items per row.
-- plaid_items already carries institution_id; accounts didn't.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS institution_id TEXT;

-- Backfill from the parent plaid_item
UPDATE public.accounts a
SET institution_id = pi.institution_id
FROM public.plaid_items pi
WHERE a.plaid_item_id = pi.id
  AND a.institution_id IS NULL
  AND pi.institution_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_institution ON public.accounts(institution_id) WHERE institution_id IS NOT NULL;
