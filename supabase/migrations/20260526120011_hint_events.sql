-- Hint dismissal reason capture (afternoon batch WS3, Task 3.1).
--
-- When a user dismisses a hint we ask why (3 quick options). The reason
-- feeds future hint targeting. We log resolves too, so we have a full
-- event stream per hint. Per-user scope (RLS) with workspace_id kept for
-- analytics joins.

CREATE TABLE IF NOT EXISTS public.hint_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hint_id UUID NOT NULL REFERENCES public.hints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hint_events_type_check
    CHECK (event_type IN ('dismissed', 'resolved')),
  CONSTRAINT hint_events_reason_check
    CHECK (
      reason IS NULL OR reason IN (
        'not_relevant', 'already_addressed', 'later'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_hint_events_hint ON public.hint_events(hint_id);
CREATE INDEX IF NOT EXISTS idx_hint_events_user ON public.hint_events(user_id, created_at DESC);

ALTER TABLE public.hint_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own hint events" ON public.hint_events;
CREATE POLICY "Users insert own hint events"
  ON public.hint_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own hint events" ON public.hint_events;
CREATE POLICY "Users read own hint events"
  ON public.hint_events FOR SELECT
  USING (auth.uid() = user_id);
