-- Task 3.3: Ask Vigilance — scoped Q&A with Claude over the user's own data.
--
-- Storage for ask history. We persist questions + answers so we can:
--   1) enforce a per-day cap (default 5/user/day — keeps cost predictable)
--   2) show the user their recent Q&A on the page (no re-asking the same Q)
--   3) eventually learn which questions are most asked
--
-- Per-user-scope, not workspace — each member of a workspace asks their
-- own questions (different context, different needs). Workspace_id stored
-- as denormalized convenience for joining if we ever need to.

create table if not exists ask_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  question text not null,
  answer text not null,
  model text not null,
  prompt_tokens integer,
  completion_tokens integer,
  created_at timestamptz not null default now()
);

create index if not exists ask_history_user_created_idx
  on ask_history (user_id, created_at desc);

alter table ask_history enable row level security;

drop policy if exists ask_history_owner_select on ask_history;
create policy ask_history_owner_select on ask_history
  for select
  using (auth.uid() = user_id);

drop policy if exists ask_history_owner_insert on ask_history;
create policy ask_history_owner_insert on ask_history
  for insert
  with check (auth.uid() = user_id);

drop policy if exists ask_history_owner_delete on ask_history;
create policy ask_history_owner_delete on ask_history
  for delete
  using (auth.uid() = user_id);
