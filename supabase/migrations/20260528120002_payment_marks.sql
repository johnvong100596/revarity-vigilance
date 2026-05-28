-- v1.1 WS3: Pay-this-week queue.
--
-- payment_marks records that the user told us "I paid this" for a specific
-- account on a specific due date. The queue UI subtracts these from the
-- upcoming list and from the H-303 overdue check.
--
-- Per-user (not per-workspace): each member tracks their own payments;
-- workspace teammates' "paid" actions don't affect another member's queue.

CREATE TABLE IF NOT EXISTS public.payment_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, account_id, due_date)
);

CREATE INDEX IF NOT EXISTS idx_payment_marks_user_due
  ON public.payment_marks(user_id, due_date);

ALTER TABLE public.payment_marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own payment marks" ON public.payment_marks;
CREATE POLICY "Users read own payment marks"
  ON public.payment_marks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own payment marks" ON public.payment_marks;
CREATE POLICY "Users insert own payment marks"
  ON public.payment_marks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own payment marks" ON public.payment_marks;
CREATE POLICY "Users delete own payment marks"
  ON public.payment_marks FOR DELETE
  USING (auth.uid() = user_id);
