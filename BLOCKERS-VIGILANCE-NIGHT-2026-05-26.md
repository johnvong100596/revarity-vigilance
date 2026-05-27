# BLOCKER — two agents are running this night batch on the same branch

**Written:** 2026-05-27, early hours. **Severity: STOP — needs Cena's decision.**

## What's happening

A second autonomous agent is executing this exact night batch on the
`day3` branch **at the same time as me**. Evidence:

- `git status` was **clean at `1f4ecb2`** when this session started.
- Within minutes, two commits I did not author appeared on `day3`:
  - `98fc473 fix(M2): make the awareness streak strictly per-user`
  - `44d2d4f fix(M1): classify APR ceiling by account_type, not free-text name`
- Files changed **mid-read** (page.tsx, checkin.ts, apr.ts updated between
  my Read and my Edit), which only happens if another writer is active.
- Commit-message style (`fix(M2):` conventional-commits) differs from the
  style I use (`WS2 (L-tier): …`), so it's a different agent run — though
  the git author identity is the same (`coo-rock-it <coo@revarity.com>`).

Two agents committing to one branch will duplicate effort and produce
semantic collisions (e.g., two different landing-page rewrites, two
different copy passes). The other agent is already ahead on Workstream 1.

## What I did (and deliberately did NOT do)

- **Stopped** rather than race. I did not commit or push any conflicting
  code. I made no edits to the files the other agent is working in
  (checkin.ts, page.tsx, apr.ts, etc.).
- **One side effect to clean up:** before I detected the conflict, I had
  started M2 the way the spec literally described — a
  `user_streaks (user_id, workspace_id, …)` table — and **applied that
  migration to the production database**, so an **empty, unused
  `public.user_streaks` table now exists in Supabase.** The other agent's
  committed M2 fix uses the existing `profiles` columns instead (a valid
  reading of "streak is per-user"), so `user_streaks` is orphaned.
  - I removed my untracked `lib/streak.ts` and the untracked migration
    file so they don't pollute the tree.
  - **Recommended:** `DROP TABLE IF EXISTS public.user_streaks;` (it's
    empty and unreferenced). Or leave it — it's harmless. Your call.

## Divergence to be aware of (M2 implementation)

- **Other agent (committed, on `day3`):** streak stays on `profiles`
  (`awareness_streak` / `best_streak` / `last_checkin_date`), made strictly
  per-user by intersecting the user's own check-ins with active accounts.
  Simple, no new table. **Caveat:** still one streak per user *globally*,
  not per-workspace — a user in two workspaces shares one streak.
- **My approach (NOT committed, reverted):** `user_streaks` keyed by
  `(user_id, workspace_id)` — per-user **and** per-workspace, matching the
  spec's literal "per-user-per-workspace" + the suggested table shape.
- Both satisfy "each member has their own streak; workspace has none." If
  you care about the multi-workspace case, the `user_streaks` approach is
  more correct; if not, the committed `profiles` approach is simpler and
  already shipped.

## What you need to decide

1. **Kill one of the two agents.** Running both on one branch is the root
   problem. Pick one to continue the batch.
2. **M2 shape:** keep the committed `profiles` per-user fix, or switch to
   `user_streaks` per-(user,workspace)? (The empty table is already in the
   DB if you want the latter.)
3. Whether to **drop the orphan `user_streaks` table** now.

I'm holding here rather than generating commits that collide with the
other agent. Ping me with which agent should own the branch and I'll
continue cleanly.
