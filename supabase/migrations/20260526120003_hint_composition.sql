-- Hint composition cache (Task 2.4, night batch 2026-05-26).
-- Adds composed_body to hints. The hint engine populates it via Claude
-- when fresh hints fire (budget-capped to 3/day/user). UI prefers
-- composed_body when set, else falls back to the templated body.

ALTER TABLE public.hints ADD COLUMN composed_body TEXT;
ALTER TABLE public.hints ADD COLUMN composed_at TIMESTAMPTZ;
