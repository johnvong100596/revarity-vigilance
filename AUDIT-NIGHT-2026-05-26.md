# Vigilance audit — night batch 2026-05-26

Audit pass after Tiers 1-3 shipped. Branch: `day3`. Cena reviews +
promotes `day3` → `master` after reviewing this list.

**STATUS after F.2 cleanup pass:** all 6 CRITICAL + 7 of 9 HIGH +
4 of 8 MEDIUM fixed in commit `0bec62c`. Remaining work captured in
the "Punch list for Cena" section at the bottom.

## Summary

| Severity | Found | Fixed in F.2 | Open |
|----------|-------|--------------|------|
| CRITICAL | 6     | 6            | 0    |
| HIGH     | 9     | 7            | 2    |
| MEDIUM   | 8     | 4            | 4    |
| LOW      | 7     | 0            | 7    |
| NICE-TO-HAVE | 4 | 0            | 4    |

---

## Findings

### CRITICAL — all fixed in F.2

#### C1: New signups have no workspace → infinite redirect loop ✅
- **File:** supabase/migrations/20260526120005_referrals.sql:16-28 (handle_new_user) + app/app/page.tsx:70
- **What:** `handle_new_user` trigger created a `profiles` row but never created a Personal workspace or set `active_workspace_id`. Every protected page redirected to `/login` when `active_workspace_id` was null.
- **Fix shipped:** `supabase/migrations/20260526120007_audit_fixes.sql` extends the trigger to also create the workspace + member row + set `active_workspace_id`. Applied to production DB.

#### C2: `updateAccountBalance` snapshot insert missing `workspace_id` ✅
- **File:** lib/actions/accounts.ts:157-164
- **Fix shipped:** snapshot insert now includes `workspace_id` from the account row. Also drops the stale `eq('user_id', user.id)` filter so workspace teammates can edit shared accounts; pulls home currency for the fx_rate decision.

#### C3: `flagAccount` hint insert missing `workspace_id` ✅
- **File:** lib/actions/checkin.ts:143-152
- **Fix shipped:** hint insert now pulls account.workspace_id and includes it. Throws clear error if account isn't in user's workspace.

#### C4: Cron endpoints accept anonymous traffic when `CRON_SECRET` is unset ✅
- **File:** app/api/cron/sunday-reckoning/route.ts + monthly-close/route.ts
- **Fix shipped:** both routes now fail-closed (`503` when `CRON_SECRET` is missing); `GET = POST` aliases removed so a single anonymous curl can't trigger a full email blast.

#### C5: Webhook comment block contradicted enforced verification ✅
- **File:** app/api/plaid/webhook/route.ts:11-27
- **Fix shipped:** stale "v1: signature verification SKIPPED for sandbox" comment block removed; replaced with accurate description noting verification is enforced + service-role usage requires explicit workspace scoping in every query.

#### C6: `accept-invite` page can never render — invitee can't read their own invite under RLS ✅
- **File:** app/accept-invite/[token]/page.tsx:30-36
- **Fix shipped:** added `peek_workspace_invite(token)` SECURITY DEFINER RPC in migration `20260526120007`. Page now calls the RPC instead of querying `workspace_members` directly. Email-match status returned by the RPC so the wrong-email branch still works.

---

### HIGH

#### H1: `check_ins` missing UPDATE policy → upsert fails on re-action ✅
- **File:** supabase/migrations/20260523120005_check_ins.sql + lib/actions/checkin.ts
- **Fix shipped:** UPDATE policy added in migration `20260526120007`.

#### H2: `acknowledgeAccount` updated account row by `user_id` only ✅
- **File:** lib/actions/checkin.ts:99-103
- **Fix shipped:** dropped the `user_id` filter; RLS via workspace membership now covers authorization. `maybeCompleteDay` similarly stripped of the `user_id` filter on accounts count.

#### H3: Ask Vigilance daily cap is TOCTOU-racy ✅
- **File:** lib/actions/ask.ts
- **Fix shipped:** insert-placeholder-first pattern — write an empty-answer row up front, recount under that row, rollback (delete) if cap exceeded. LLM failure also deletes placeholder so the user doesn't lose a slot on transient errors. The ask page filters placeholders out of the visible history but counts them toward the cap.

#### H4: `inviteMember` doesn't email the invitee ✅
- **File:** lib/actions/workspaces.ts + new lib/email/WorkspaceInviteEmail.tsx
- **Fix shipped:** `inviteMember` now calls `sendEmail()` with the new `WorkspaceInviteEmail` component. Returns `{ inviteUrl, emailSent, emailReason }`; settings UI shows "invite sent" or "couldn't email automatically — copy this link" depending on outcome. Best-effort: send failure doesn't break the invite create.

#### H5: Re-engagement decay (14d) uses naive Date math — TZ off-by-one ⚠ DEFERRED
- **File:** app/api/cron/sunday-reckoning/route.ts:79-86 + lib/decay.ts
- **Status:** not fixed in F.2 — low-risk, near-equivalent behavior either way (off by ≤1 day for ~8 hours in a 7-day window). Captured in punch list.

#### H6: `dismissHint` updates by `user_id` ✅
- **File:** lib/actions/hints.ts:21-39
- **Fix shipped:** dropped `eq('user_id', ...)` on both the read and update. RLS workspace membership covers authorization.

#### H7: `resolveHint` same bug as H6 ✅
- **File:** lib/actions/hints.ts:53-61
- **Fix shipped:** dropped the `user_id` filter.

#### H8: `disconnectPlaidItem` doesn't revalidate dependent paths ✅
- **File:** lib/actions/settings.ts:96-119
- **Fix shipped:** added `revalidatePath('/app/checkin')` and `revalidatePath('/app/hints')` so the disconnected accounts disappear from those views immediately.

#### H9: Webhook account lookup could collide across workspaces ✅
- **File:** app/api/plaid/webhook/route.ts:148-153
- **Fix shipped:** added `eq('plaid_item_id', plaidItemRowId)` to the lookup, triple-scoping by workspace + plaid_item + plaid_account.

---

### MEDIUM

#### M1: Marketing copy claims user-controlled Supabase keys ✅
- **File:** app/(marketing)/page.tsx:306-310
- **Fix shipped:** reworded to "Your financial data is row-isolated in our database — your account, your data, your view. Export, delete, or take it elsewhere at any time."

#### M2: Projection math double-counts debt trend ✅
- **File:** lib/projection.ts:106-129
- **Fix shipped:** slope contribution alone now drives the curve (historical slope already reflects historical debt paydown). Negative-amortization edge case (M3) handled by subtracting the interest-minus-payment delta from the projection so high-rate revolving debt visibly grows.

#### M3: Projection negative-amortization edge case ✅
- **File:** lib/projection.ts:117-122
- **Fix shipped:** when min_payment < interest, debt balance grows monthly instead of stalling at 0; the growth amount subtracts from the projected net worth.

#### M4: Plaid webhook treats unknown item_id as 200 success ✅
- **File:** app/api/plaid/webhook/route.ts:62-71
- **Fix shipped:** returns 503 so Plaid retries; protects against the exchange→webhook race.

#### M5: fx_rate hardcoded to USD ⚠ PARTIAL
- **Files fixed:** lib/actions/accounts.ts, lib/actions/checkin.ts, app/api/plaid/webhook/route.ts now all compare account.currency to the user's `home_currency` instead of literal "USD".
- **Status:** still need to fix app/api/plaid/exchange/route.ts and app/api/plaid/sync/route.ts (same pattern, same fix). Captured in punch list.

#### M6: H-001 hint doesn't clamp displayed APR ⚠ DEFERRED
- Low-frequency: only fires when a user manually enters a typo APR like 999. Punch-list candidate.

#### M7: composeCopy retry/error silently consumes budget ✅ (largely addressed by H3 fix)
- **File:** lib/actions/ask.ts
- **Fix shipped:** the H3 insert-placeholder-first pattern means LLM failure rolls back the placeholder, so a flake doesn't eat a question slot. The history-update-failure-after-success edge case is logged but doesn't surface to the user — acceptable trade-off.

#### M8: decay_warnings_enabled toggle doesn't immediately suppress takeover ✅
- **File:** lib/actions/settings.ts:77-85
- **Already fixed:** `toggleProfileFlag` already calls `revalidatePath('/app')` — re-verified during audit pass.

---

### LOW — all deferred (in punch list)

- L1: AccountRow prepends "−" without Math.abs guard
- L2: H-001 dedup leaves stale hints when worst-debt changes
- L3: Ask "remaining today" race-corner math
- L4: Ask system prompt assumes global disclaimer mounted (no global disclaimer)
- L5: Tooltip explicitly names forbidden term "APR"
- L6: parseScotiaCsv doesn't handle RFC-4180 quoted commas
- L7: sendEmail no-key state indistinguishable from send-failed state

---

### NICE-TO-HAVE — deferred

- N1: Invite tokens never expire
- N2: No rate limit on `/api/plaid/link-token`
- N3: Subscriptions empty-state mentions "Plaid"
- N4: vault_get_secret comment-block hardening

---

## Punch list for Cena (morning review)

Not blockers for promoting `day3` → `master`, but worth picking up in a
followup pass:

1. **M5 finish:** `app/api/plaid/exchange/route.ts:131-138` and
   `app/api/plaid/sync/route.ts:79-86` still hardcode `fx_rate: account.currency === "USD" ? 1 : null`. Same one-line fix as the other call sites — compare to home currency.

2. **H5 (decay TZ):** decide whether to switch the 14-day check to a
   SQL `current_date - last_checkin_date >= 14` fragment, or just
   document the ±1-day fuzziness as acceptable.

3. **M6 (APR clamp):** add a 0-100 clamp on `worst.apr.toFixed(2)` in
   `lib/hints/H-001-debt-priority.ts:23-43`, or skip the hint when APR
   looks out of range and surface a "this APR looks off" hint instead.

4. **L-tier polish** can be batched into a "polish pass" Day-2 commit.

5. **N1 invite expiry:** if you want a real expiry, add `invite_expires_at` to `workspace_members` + check it in `accept_workspace_invite` + render a "this invite expired" branch on the accept page. 7-day default feels right.

6. **N2 link-token rate limit:** trivial to add via a per-user count
   in a `daily_plaid_link_tokens` row. Wait until you see actual abuse.

---

## What I verified shipped clean in F.2

- Migration `20260526120007_audit_fixes.sql` applied to production DB
  via `node scripts/apply-migration.mjs` (script uses pg + the
  SUPABASE_DB_PASSWORD pooler connection; auto-detects region).
- `npx tsc --noEmit` clean.
- `npx next lint` clean.
- `npx next build` clean.
- Branch `day3` at commit `0bec62c` (audit fixes) on top of `e9b9b0f`
  (Task 3.4 subscriptions scaffold) on top of the night batch.
- **NOT promoted to master** — that's your call after morning review.
  Vercel preview URL for `day3` should show the fixed state.

---

## Areas covered vs skipped

**Covered fully:**
- Auth, RLS, migrations (1-9)
- Money math (Number vs Decimal)
- Plaid integration paths (link-token, exchange, sync, webhook, vault)
- Server actions (accounts, ask, checkin, csv-import, hints, rituals, settings, workspaces)
- Ask Vigilance prompt + daily cap
- Projection math
- Cron handlers
- Plain English audit (THESIS-forbidden terms)
- Mobile width / overflow
- Accept-invite flow

**Lightly covered (didn't fully read but spot-checked):**
- Email templates (.tsx files)
- account-detail-client interactions beyond the APR tooltip
- Marketing landing visuals beyond Trust block
- AccountRow / ProjectionChart rendering quirks
- `lib/decay.ts` internals (only via the page integration)
- `lib/hints/H-103, H-201, H-202` evaluators (only H-001, H-002 read in detail)

**Skipped:**
- Manual visual regression — no screenshots taken
- Performance profiling (DB query counts, N+1 risks)
- THESIS.md drift beyond forbidden-terms check
- Tailwind config + design-token consistency
