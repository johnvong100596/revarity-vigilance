-- Perf audit L1: the home page + ritual crons query balance_snapshots by
-- workspace_id with a captured_at range. The existing index on workspace_id is
-- single-column, forcing a filter+sort on captured_at. Add the composite that
-- matches the exact access pattern. Additive, safe (CREATE INDEX IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS idx_balance_snapshots_workspace_date
  ON public.balance_snapshots (workspace_id, captured_at DESC);
