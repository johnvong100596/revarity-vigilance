-- Check-ins: one row per (user, account, day). Drives the daily swipe ritual
-- + awareness streak. UNIQUE constraint prevents double-counting a day.
-- ARCHITECTURE.md §3 + THESIS.md §2.

CREATE TABLE public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_ins_action_check
    CHECK (action IN ('acknowledged','flagged','updated')),
  UNIQUE(user_id, account_id, checkin_date)
);

CREATE INDEX idx_check_ins_user_date ON public.check_ins(user_id, checkin_date DESC);

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own check-ins"
  ON public.check_ins FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own check-ins"
  ON public.check_ins FOR INSERT WITH CHECK (auth.uid() = user_id);
