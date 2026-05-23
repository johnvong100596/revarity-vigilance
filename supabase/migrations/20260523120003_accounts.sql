-- Accounts: every financial account the user wants to track.
-- Native currency stored in `currency` + `balance`; home-currency conversion
-- happens at snapshot time (see balance_snapshots). ARCHITECTURE.md §3 + §8.

CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subtitle TEXT,
  account_type TEXT NOT NULL,
  category TEXT NOT NULL,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  apr NUMERIC(5,2),
  min_payment NUMERIC(12,2),
  payment_due_day INTEGER,
  renewal_date DATE,
  credit_limit NUMERIC(12,2),
  statement_close_day INTEGER,
  source TEXT NOT NULL DEFAULT 'manual',
  plaid_account_id TEXT,
  plaid_item_id UUID REFERENCES public.plaid_items(id) ON DELETE SET NULL,
  crypto_symbol TEXT,
  crypto_quantity NUMERIC(20,8),
  quick_login_url TEXT,
  last_acknowledged_at TIMESTAMPTZ,
  last_balance_updated_at TIMESTAMPTZ,
  position INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT accounts_account_type_check
    CHECK (account_type IN ('bank','crypto','investment','loan','cash')),
  CONSTRAINT accounts_category_check
    CHECK (category IN ('asset','debt')),
  CONSTRAINT accounts_source_check
    CHECK (source IN ('plaid','manual','csv','crypto_api')),
  CONSTRAINT accounts_payment_due_day_check
    CHECK (payment_due_day IS NULL OR (payment_due_day BETWEEN 1 AND 31)),
  CONSTRAINT accounts_statement_close_day_check
    CHECK (statement_close_day IS NULL OR (statement_close_day BETWEEN 1 AND 31))
);

CREATE INDEX idx_accounts_user_active ON public.accounts(user_id) WHERE archived = false;
CREATE INDEX idx_accounts_plaid_item ON public.accounts(plaid_item_id) WHERE plaid_item_id IS NOT NULL;

CREATE TRIGGER set_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own accounts"
  ON public.accounts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own accounts"
  ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own accounts"
  ON public.accounts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users delete own accounts"
  ON public.accounts FOR DELETE USING (auth.uid() = user_id);
