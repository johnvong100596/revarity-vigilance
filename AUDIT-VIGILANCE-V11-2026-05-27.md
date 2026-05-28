# Audit — v1.1 Operator Tier batch

**Scope:** commits `1079b36..HEAD` on `day3` (8 commits — WS1/WS2/WS3/WS4/WS5/WS6+WS8/WS7/WS9). Earlier work audited separately in AUDIT-VIGILANCE-NIGHT/AFTERNOON/NIGHT-2026-05-26.md — NOT re-audited here.

Build: clean (`tsc --noEmit`, `next lint`, `next build` all pass per the brief).

## Summary

- CRITICAL: 0
- HIGH: 2 → **both FIXED** (migration `20260528120004_v11_rls_hardening.sql` applied)
- MEDIUM: 5 → morning punch list
- LOW: 6 → morning punch list

Verdict: the batch is safe to ship. Both HIGHs are RLS defense-in-depth gaps the UI papers over today; the fix migration closes them. The MEDIUMs are correctness/UX rough edges, not data leaks.

## Disposition

- **H-1 FIXED** — BEFORE UPDATE trigger `pin_entities_is_personal` raises when `OLD.is_personal IS DISTINCT FROM NEW.is_personal`, so a user can't flip the Personal entity's flag off and then delete it. Rename / recolor still work.
- **H-2 FIXED** — `ious` INSERT/UPDATE policies now require `entity_id` (when set) to belong to `auth.uid()`. `inter_entity_flows` INSERT/UPDATE policies require BOTH `from_entity_id` and `to_entity_id` to belong to `auth.uid()`. Server actions still validate too — defense in depth restored.

**Morning punch list** (MEDIUM + LOW, not fixed):
- M-1 `setOperator` Personal-entity seed TOCTOU (catch 23505)
- M-2 `EntityAssign` silent no-op for non-admin workspace members
- M-3 cash runway under-counts investment-typed operating cash
- M-4 recurring IOU window edge case
- M-5 H-303 over-fires (passes empty paidMarks — same as previous audit; benign)
- L-1..L-6 polish items (settings extra query, URL-param filtering for non-operators, zero-amount IOUs, recurring+dueDate conflict, IOU-list TZ display, benign month-clamp note)

---

## HIGH

### H-1 — `entities` UPDATE policy lets a user flip `is_personal=false`, then delete the Personal row
**Where:** `supabase/migrations/20260528120001_operator_tier_entities.sql:43-50`
**What:** The UPDATE policy has `USING (auth.uid() = user_id)` and no `WITH CHECK` constraint protecting `is_personal`. The DELETE policy correctly blocks `is_personal = true`, but a malicious user (or buggy client) can `UPDATE entities SET is_personal=false WHERE id=…` then DELETE. The two-step is a trivial bypass of the "Personal can't be deleted" rule.
**Why it matters:** The Personal entity is a UX invariant — IOUs / accounts / hints assume tagging always has a default home. Losing it leaves the operator's data in an awkward partially-untagged state. Not a data leak; an integrity bug.
**Fix:** Add a `WITH CHECK` to the UPDATE policy that disallows setting `is_personal` to `false` (or block the field entirely from user UPDATEs via a column-level revoke, or a BEFORE UPDATE trigger that pins `NEW.is_personal = OLD.is_personal`). Cheapest is `WITH CHECK (auth.uid() = user_id AND is_personal = (SELECT is_personal FROM entities WHERE id = entities.id))` — or just `WITH CHECK (auth.uid() = user_id AND is_personal = true)` paired with a separate "non-personal" update path.

### H-2 — `inter_entity_flows` RLS only checks `user_id`, not entity ownership
**Where:** `supabase/migrations/20260528120003_ious_and_inter_entity.sql:93-101`
**What:** INSERT/UPDATE policies enforce `auth.uid() = user_id`, and a CHECK constraint enforces `from ≠ to`. Nothing in RLS verifies that `from_entity_id` or `to_entity_id` actually belong to the calling user — a user can INSERT a flow whose user_id is themselves but whose `from_entity_id` is some other user's entity (entity ids are UUIDs, not enumerable, but they're guessable from any leak: support log, screenshot, copy/paste). The server action `createFlow` (`lib/actions/ious.ts:151-161`) does verify, so the realistic risk is "a non-action codepath or curl against the Supabase REST endpoint with the user's JWT can corrupt the data model." Same gap on `ious.entity_id`.
**Why it matters:** Defense in depth: the audit promise is "RLS alone protects." Today the server action is the only gate. Anything that bypasses it (future cron, direct API client, postgres-meta inspection tool) skips the check.
**Fix:** Add `WITH CHECK (… AND from_entity_id IN (SELECT id FROM entities WHERE user_id = auth.uid()) AND to_entity_id IN (SELECT id FROM entities WHERE user_id = auth.uid()))` on insert/update. Same pattern for `ious.entity_id` on insert/update.

---

## MEDIUM

### M-1 — `setOperator` Personal-entity seed is racy (count=0 check is TOCTOU)
**Where:** `lib/actions/operator.ts:33-46`
**What:** `if ((count ?? 0) === 0) → insert Personal`. Two rapid invocations (double-tap of the toggle, or auto-refresh during transition) can both see count=0 and both insert. The UNIQUE constraint on `(user_id, name)` would catch the duplicate ("Personal","Personal") with a 23505 error, but the action doesn't catch that — it will throw "operator toggle failed: …" surfaced from a *successful* toggle.
**Why it matters:** A worst-case UI shows an error after the action actually succeeded; the second insert is rejected by the DB but the error bubbles. Cena-level operator unlikely to double-tap, but the React `pending` guard on the toggle is local-only.
**Fix:** Wrap the seed in `try/catch` and swallow 23505, or change the SELECT to `count("exact")` followed by an `INSERT … ON CONFLICT DO NOTHING`.

### M-2 — `EntityAssign` lets you tag a workspace account whose workspace you're a non-admin member of (UI ok, RLS will reject)
**Where:** `lib/actions/operator.ts:168-200`; `components/EntityAssign.tsx:30-44`
**What:** `tagAccountWithEntity` verifies the entity belongs to the user but does NOT verify the account is in a workspace the user can update. RLS on `accounts.UPDATE` requires owner/admin (per `supabase/migrations/20260526120002_workspaces.sql:233-235`), so a plain "member" calling the action will silently no-op (no rows updated, no error). The component shows no error but `router.refresh()` shows no change either — the dropdown silently "snaps back" on next paint.
**Why it matters:** Confusing UX for shared workspaces where a non-admin operator tries to tag. Not a security issue (RLS protects), just a quiet failure.
**Fix:** Either `.single()` the update so a 0-row affect surfaces as an error, or gate the EntityAssign render on `myRole IN ('owner','admin')` server-side in `app/app/accounts/[id]/page.tsx`.

### M-3 — Cash runway counts cash only from `account_type IN ('bank','cash')`, ignoring `investment`-typed operating accounts
**Where:** `lib/runway.ts:71-75`
**What:** Many operators (Cena's profile included) treat brokerage / money-market / HISA accounts (`account_type='investment'`) as operating capital. Runway treats their balance as $0 cash, dramatically under-stating runway when a chunk of liquidity lives in investment-typed accounts. Per the audit prompt, this is flagged as "acceptable approximation" — but for Cena's $1M+ Excel profile the divergence will be obvious.
**Why it matters:** H-307 will fire false-positively for operators who keep cash in HISA accounts tagged as investments. Worse, the home widget will show a wrong "0 days" when the user has $200K in a HISA.
**Fix:** Document the rule near the runway widget ("Cash here means checking/savings"), or extend the heuristic to include `account_type='investment' AND subtitle matches /HISA|money market|savings|operating/i`. Easiest near-term: just add the heuristic + comment. The audit prompt explicitly accepted this as an approximation, so logging it as a follow-up rather than a blocker.

### M-4 — Runway recurring IOU "next occurrence" logic skips when the cycle just passed
**Where:** `lib/runway.ts:38-58, 92-101`
**What:** `nextMonthlyOccurrenceWithinDays` returns the NEXT future occurrence. If an IOU has `recurring={day_of_month: 15}` and today is the 16th, the next occurrence is ~29 days away — still in the 30-day window, so it's counted. Edge case: today is the 1st, day_of_month=31 in February — next clamps to Feb 28 (yesterday-ish), then `target < start` rolls to Mar 31. That's 30+ days out depending on the year — could miss the window by a day. Walking the prompt's example (day 15 IOU, today is day 16): next = day 15 of next month, ~29 days. Within the 30-day window → counted. So the prompt's worry doesn't actually fire today.
**Why it matters:** Behaves correctly in the common case. The 30-day-edge clamp issue (Feb 28-ish dates) could occasionally drop one recurring obligation per year — minor.
**Fix:** None required. Note if you tighten the window to 28 days or run mid-month, revisit.

### M-5 — H-303 still passes empty `paidMarks` set; over-fires until user mutes
**Where:** `lib/hints/H-303-payment-overdue.ts:20`
**What:** Confirmed unchanged from the earlier audit. The hint fires on the previous cycle even when the user has tapped "Mark paid" in the PayThisWeek widget. The dedup keeps it from re-firing, but the first firing is wasted on already-paid items.
**Why it matters:** Annoying for users who pay through their bank (not the app). Recurring "Pay attention" hint they have to dismiss every cycle.
**Fix:** Extend `UserContext` with `paidMarks: Set<string>` populated from the engine's profile-id fetch, then pass it to `buildUpcomingPayments`.

---

## LOW

### L-1 — Settings page loads `entities` for ALL users, even non-operators
**Where:** `app/app/settings/page.tsx:76-82`
**What:** The `entitiesRes` query runs for every settings render regardless of `is_operator`. Non-operators get an empty array (no rows due to RLS-by-user_id + no inserts), so it's correct, but it's a wasted round-trip on a hot page.
**Why it matters:** 1 extra Supabase query per /app/settings load for ~90% of users. Trivially cheap (RLS-filtered, returns 0 rows), but easy to skip.
**Fix:** Move the entities fetch into the `if (profile.is_operator)` branch or do it conditionally in a `Promise.all` only when needed.

### L-2 — Non-operator users with `?entity=...` URL param see filtered accounts and no chips to escape
**Where:** `app/app/page.tsx:71, 200-204`
**What:** Anyone hitting `/app?entity=<uuid>` (paste, share, history) gets the accounts filtered to that entity — no chip rendered because chips render gated on `isOperator`. Non-operator with a shared link sees an empty/wrong account list. Not a security leak (RLS prevents cross-user reads; entity_id values are user-scoped UUIDs), just confusing.
**Why it matters:** Niche UX edge.
**Fix:** Force `entityFilter = null` when `!isOperator`.

### L-3 — `IouForm` allows `amount === 0` since `.min(0)` is permissive
**Where:** `lib/actions/ious.ts:22`; `components/IousClient.tsx:488`
**What:** Both server (`z.number().min(0)`) and client (`numAmount < 0`) accept zero. A zero-IOU row is meaningless and appears in the ledger forever.
**Why it matters:** Minor data hygiene.
**Fix:** Tighten to `.gt(0)` on the schema and `numAmount <= 0` in the form.

### L-4 — `IouForm` lets you pick `recurring.day_of_month` AND `dueDate` — they aren't reconciled
**Where:** `lib/actions/ious.ts:25-26`; `components/IousClient.tsx:556-580`
**What:** Both fields submit independently. If both are set, the row will surface in H-305 (due_date branch) AND H-306 (recurring branch). Cosmetic duplication but the engine's per-template dedup keeps it from spamming.
**Why it matters:** Doubled hint paths for one IOU. Engine dedup catches it at template granularity; not visible to user beyond a redundant log entry.
**Fix:** Either disable `dueDate` when `recurringDay` is set in the form, or pick one ("recurring means use day-of-month; one-time means use dueDate") and zero the other server-side.

### L-5 — `IouRow` due-date display uses `new Date(iou.due_date)` (no T00:00:00) → can render as previous day in negative-offset timezones
**Where:** `components/IousClient.tsx:221`
**What:** `new Date("2026-05-15")` parses as UTC midnight; for a user in PST (UTC-7), `toLocaleDateString` renders as May 14. The runway/H-305 logic correctly uses `+T00:00:00`. The IousClient row doesn't.
**Why it matters:** Off-by-one day display for the IOU list in west-of-UTC timezones. Just visual — the underlying ISO date is right.
**Fix:** `new Date(iou.due_date + "T00:00:00")` to anchor in local time, matching the runway/hints code.

### L-6 — `previousDueDateFromDayOfMonth` and `nextDueDateFromDayOfMonth` clamp `day` to month length, hiding a real "due day was 31, this month is Feb" overdue case
**Where:** `lib/payments.ts:30-64`
**What:** A card with `payment_due_day=31` in February clamps to 28. If today is Mar 2, the "previous due" computes as Feb 28, which is past — correct as overdue (3 days). If today is Feb 28, previous=Feb 28=today, NOT overdue (matches Feb 28 paid behavior). The clamp can hide a one-day window where the bank's actual due was earlier than the clamp suggests, but for credit-card payment_due_day from Plaid this is exactly right (banks honor the same clamp). Logging for awareness; no fix.
**Why it matters:** Edge-case behavior is consistent with how lenders post the due date, so safe in practice.
**Fix:** None.

---

## Areas verified clean

- **WS5 EntityFilter** (`components/EntityFilter.tsx`): chips render only via parent gating (`isOperator && entities.length > 0`); URL-state model is sound; `scroll={false}` preserves position; values cleanly map `null/uuid/"untagged"`.
- **WS6 IOU server actions** (`lib/actions/ious.ts`): every mutator re-loads `auth.uid()` from supabase before writing; Zod schemas are tight; `createFlow` does the two-entity ownership check that RLS is missing (see HIGH H-2).
- **WS7 CashRunway widget** (`components/CashRunway.tsx`): empty-data short-circuit at line 28-34 prevents render when there's nothing meaningful; tone colors map to the urgency tier correctly.
- **WS7 calculateRunway** (`lib/runway.ts`): IOU iteration correctly checks `status==='active'`, finite amount, due date in window OR recurring in window. The `incoming - outgoing` framing for sustainability flag is right. Credit-card minimums only counted when both `min_payment` AND `payment_due_day` present + in window.
- **WS1 OperatorSection UI** (`components/OperatorSection.tsx`): toggle disables during pending transition; Personal row hides edit/delete buttons; color picker uses inline style (safe — palette is hard-coded, no user-controlled hex).
- **Hint engine integration** (`lib/hints/engine.ts:69-78`): IOUs are fetched only when `profile.is_operator` is true; `ious: []` default flows correctly through H-305/H-306; `H-307` explicitly checks `ctx.profile.is_operator` at the top of `eval`.
- **WS3 PayThisWeek server actions** (`lib/actions/payments.ts`): 23505 (already marked) treated as success; unmark uses three-column equality on the unique key.
- **Operator gating on /app/ious** (`app/app/ious/page.tsx:26`): non-operators redirect to `/app` (server-side, before render). Nav from home is also gated on `isOperator`.
- **Account-detail EntityAssign render gate** (`app/app/accounts/[id]/page.tsx:124-132`): only renders for operators with entities.
- **TypeScript types** (`lib/types.ts:86-134`): Entity / Iou / InterEntityFlow shapes match the migration SQL one-for-one (snake_case, nullables, numeric → number, JSONB → `IouRecurring | null`).
- **Profile.is_operator field**: column added in migration with NOT NULL DEFAULT false; type updated in `lib/types.ts:81`; engine reads from `profiles.*`.
- **H-301 / H-302 evaluators**: thresholds correct (70%/50%); the "yield to H-002" check in H-301 avoids double-firing on the same card; H-302 honest-percentage handling (exclude `credit_limit=0` accounts) right.
- **H-304 (NOT registered)**: confirmed `lib/hints/H-304-subscription-burn.ts:31` returns `{fires: false}` early; not in `lib/hints/registry.ts`. Safe inert scaffold.
- **WS9 WelcomeMoment guard** (`components/WelcomeMoment.tsx:30-39`): sessionStorage check runs before `markWelcomed()`, falls through on Safari-private failure to the original behavior. Correct fix for M-2.
- **WS9 banned-word sweep on /privacy + /terms**: spot-checked `app/privacy/page.tsx` and `app/terms/page.tsx` body for the audit-flagged words (`disconnect`, `Liability`, `token`, `API`, `authentication`, `sync`). Privacy still uses "access keys" (good), "sign-in" (good), "Claude" (good — not "Claude API"). Terms now uses "Our responsibility" instead of "Liability". Cleared.
- **New user-facing copy on Tier-2 surfaces** (EntityFilter chips "All"/"Untagged", OperatorSection "I run businesses"/"Your businesses"/"Can't remove", IousClient "I owe"/"Owed to me"/"Between mine"/"Mark settled", CashRunway "Sustainable"/"days of runway"/"Cash on hand"/"Coming in"/"Going out"/"Net this month", CreditPage "Using X% of your credit"/"Owing now"/"Still available"): plain-English throughout, no banned words.
- **Net-worth + IOU math** (`app/app/page.tsx:240-246`): account sum uses `accounts` (entity-scoped), IOU adders use `filteredIous` (same scope rules — confirmed lines 173-177, 200-204 use IDENTICAL filter clauses). All three filter cases (no filter / specific entity / untagged) are walk-throughed consistent. Non-operators see `iousOwedByMe=iousOwedToMe=0` because `activeIous=[]`.
- **Operator-only home widgets**: cash runway rendered only when `isOperator && runwaySummary` (line 461); IOU subtitle gated on `isOperator && (iousOwedByMe>0 || iousOwedToMe>0)` (line 411); "Money in & out" link gated on `isOperator` (line 603). Non-operators see zero leak.
- **Perf**: home-page additions are 2 Supabase queries (entities + ious) gated on `is_operator`; both are user-scoped, indexed, small. Payment-marks query is bounded ±35 days. No N+1, no await-in-loop.
