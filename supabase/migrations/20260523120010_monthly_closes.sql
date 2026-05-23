-- Monthly closes: last-day-of-month review artifacts. Once locked, the row
-- is immutable — no UPDATE policy. ARCHITECTURE.md §3, THESIS.md §3
-- (Monthly Close, "the annual report for yourself, every 30 days").

CREATE TABLE public.monthly_closes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  net_worth NUMERIC(14,2),
  monthly_change NUMERIC(14,2),
  waterfall_breakdown JSONB,
  wins JSONB,
  drags JSONB,
  notes TEXT,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, month),
  CONSTRAINT monthly_closes_month_format
    CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

CREATE INDEX idx_monthly_closes_user_month
  ON public.monthly_closes(user_id, month DESC);

ALTER TABLE public.monthly_closes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own monthly closes"
  ON public.monthly_closes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own monthly closes"
  ON public.monthly_closes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- No UPDATE / DELETE policy: monthly closes are locked artifacts.
