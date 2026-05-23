-- Hints: each fired hint is one row. Nightly cron computes new ones,
-- dedupes against existing active rows. Severity scoring + 3-dismiss
-- auto-mute happen in app code, not SQL.
-- ARCHITECTURE.md §3 + §6, THESIS.md §6.

CREATE TABLE public.hints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hint_template_id TEXT NOT NULL,
  category TEXT NOT NULL,
  severity_score INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data_snapshot JSONB,
  related_account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  action_label TEXT,
  action_target TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  dismissed_count INTEGER NOT NULL DEFAULT 0,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  CONSTRAINT hints_category_check
    CHECK (category IN ('pay_attention','opportunity','strategic')),
  CONSTRAINT hints_status_check
    CHECK (status IN ('active','dismissed','acted','muted'))
);

CREATE INDEX idx_hints_user_active
  ON public.hints(user_id, fired_at DESC) WHERE status = 'active';

CREATE INDEX idx_hints_template_dedup
  ON public.hints(user_id, hint_template_id, status);

ALTER TABLE public.hints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own hints"
  ON public.hints FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own hints"
  ON public.hints FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own hints"
  ON public.hints FOR UPDATE USING (auth.uid() = user_id);
