-- Balance snapshots: nightly capture of every account's balance, pre-converted
-- to the user's home currency. fx_rate stored for audit trail.
-- ARCHITECTURE.md §3 + §6 + §8.

CREATE TABLE public.balance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(14,2) NOT NULL,
  balance_home_currency NUMERIC(14,2) NOT NULL,
  fx_rate NUMERIC(10,6),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapshots_user_date ON public.balance_snapshots(user_id, captured_at DESC);
CREATE INDEX idx_snapshots_account_date ON public.balance_snapshots(account_id, captured_at DESC);

ALTER TABLE public.balance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own snapshots"
  ON public.balance_snapshots FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own snapshots"
  ON public.balance_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
