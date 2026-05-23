-- FX rates: USD-base table refreshed every 4 hours by fx-refresh cron.
-- UNIQUE per (base, target, day) via a UNIQUE INDEX since Postgres doesn't
-- allow functional expressions in UNIQUE table constraints — see
-- ARCHITECTURE.md §3 spec ambiguity, resolved per owner approval.
-- ARCHITECTURE.md §8.

CREATE TABLE public.fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  rate NUMERIC(10,6) NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fx_rates_rate_positive CHECK (rate > 0)
);

CREATE UNIQUE INDEX fx_rates_pair_day_unique
  ON public.fx_rates(base_currency, target_currency, (DATE(captured_at)));

CREATE INDEX idx_fx_rates_latest
  ON public.fx_rates(base_currency, target_currency, captured_at DESC);

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

-- Global reference data: any signed-in user can read.
CREATE POLICY "Authenticated users read fx rates"
  ON public.fx_rates FOR SELECT TO authenticated
  USING (true);
