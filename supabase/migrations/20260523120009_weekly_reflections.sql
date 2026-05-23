-- Weekly reflections: Sunday Reckoning artifacts. One per (user, week).
-- ARCHITECTURE.md §3, THESIS.md §3 (Sunday Reckoning).

CREATE TABLE public.weekly_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_starting DATE NOT NULL,
  reflection_text TEXT,
  net_worth_start NUMERIC(14,2),
  net_worth_end NUMERIC(14,2),
  biggest_movers JSONB,
  payments_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_starting)
);

CREATE INDEX idx_weekly_reflections_user_week
  ON public.weekly_reflections(user_id, week_starting DESC);

ALTER TABLE public.weekly_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own weekly reflections"
  ON public.weekly_reflections FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own weekly reflections"
  ON public.weekly_reflections FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own weekly reflections"
  ON public.weekly_reflections FOR UPDATE USING (auth.uid() = user_id);
