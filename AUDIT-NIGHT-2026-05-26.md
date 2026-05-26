# Vigilance audit — night batch 2026-05-26

Audit pass after Tiers 1-3 shipped. Branch: day3. Cena reviews + promotes
day3 → master after reviewing this list.

## Summary
- CRITICAL: 6
- HIGH: 9
- MEDIUM: 8
- LOW: 7
- NICE-TO-HAVE: 4

## Findings

### CRITICAL

#### C1: New signups have no workspace → infinite redirect loop
- **File:** supabase/migrations/20260526120005_referrals.sql:16-28 (handle_new_user) + app/app/page.tsx:70
- **What:** `handle_new_user` trigger creates a `profiles` row but never creates a Personal workspace or sets `active_workspace_id`. Every protected page redirects to `/login` when `active_workspace_id` is null; middleware then bounces the authed user back to `/app`.
- **Why it matters:** Any new user signing up after the workspace migration cannot get past the login screen — they spin in a redirect loop. The backfill only covered existing users.
- **Fix:** Extend `handle_new_user` to also INSERT a "Personal" workspace + workspace_members row + set `active_workspace_id`, mirroring the backfill block in the workspaces migration.

#### C2: `updateAccountBalance` snapshot insert missing `workspace_id` → NOT NULL violation
- **File:** lib/actions/accounts.ts:157-164
- **What:** Insert into `balance_snapshots` omits `workspace_id`. Migration `20260526120002_workspaces.sql` set that column NOT NULL after backfill.
- **Why it matters:** Every call to this action throws at runtime (and is used by the account-detail edit path). Money-bearing UX is broken.
- **Fix:** Pull `workspace_id` from the account row (already read at line 141) and include in the insert.

#### C3: `flagAccount` hint insert missing `workspace_id` → NOT NULL violation
- **File:** lib/actions/checkin.ts:143-152
- **What:** Inserts a row into `hints` without `workspace_id`; column was made NOT NULL by the workspaces migration.
- **Why it matters:** Flagging an account during daily check-in throws. Flag is one of three primary check-in actions — this is on the daily critical path.
- **Fix:** Look up `workspace_id` from the account (or pass through context) and include it in the insert.

#### C4: Cron endpoints accept anonymous traffic when `CRON_SECRET` is unset
- **File:** app/api/cron/sunday-reckoning/route.ts:35-41 + app/api/cron/monthly-close/route.ts:24-30
- **What:** Both handlers gate on `if (cronSecret) { ... check ... }`. If the env var is missing or accidentally unset in Vercel, the routes accept any POST/GET. They also alias `GET = POST` so a public curl triggers a real send-loop.
- **Why it matters:** Anyone hitting `/api/cron/sunday-reckoning` could trigger a full email blast to every opted-in user, burning Resend quota and spamming users. `GET = POST` makes it a single-URL drive-by.
- **Fix:** Fail closed — `if (!cronSecret) return 503`. Remove the `GET = POST` alias or scope it to a Vercel probe check.

#### C5: Plaid webhook handler doesn't 404 unknown items behind verified signature, but `accountsGet` runs on attacker-shaped payloads if verification ever degrades
- **File:** app/api/plaid/webhook/route.ts:39-49, 73-117
- **What:** Verification is correctly enforced (good — supersedes the stale "skipped for sandbox" comment at lines 19-22, leftover from spec drift). However, the webhook handler uses `createAdminClient()` (service-role) and the *payload's* `account_ids` to mutate accounts; if `verifyPlaidWebhook` ever returns true on a malformed body (e.g., a Plaid key rotation we mis-handle), the handler will iterate `accountsGet` results bypassing RLS.
- **Why it matters:** The signature check is sound today, but the comment block at the top of the file actively misdescribes the runtime behavior — future maintainer may "fix" the supposed gap by relaxing verification.
- **Fix:** Delete the stale "v1 status: signature verification SKIPPED for sandbox" comment block (lines 19-22). It contradicts the actual code and is a footgun.

#### C6: `accept-invite` page can never render — invitee can't read their own pending invite under RLS
- **File:** app/accept-invite/[token]/page.tsx:30-36
- **What:** `supabase.from("workspace_members").select(...).eq("invite_token", token).maybeSingle()` is gated by the `workspace_members` SELECT policy `is_workspace_member(workspace_id)`. The invitee is not yet a member, so the lookup always returns null and the page renders the "Invite not found" branch.
- **Why it matters:** Every workspace invite is broken in the UI. Owners send a link, recipient clicks, page says "doesn't work anymore". Even though the underlying `accept_workspace_invite` RPC works, the user never reaches the Accept button.
- **Fix:** Add a SECURITY DEFINER RPC like `peek_workspace_invite(token)` returning `{workspace_name, invited_email, role, already_accepted}` (validating email match like `accept_workspace_invite` does), or add an RLS policy allowing select where `invited_email = (select email from auth.users where id = auth.uid())`.

---

### HIGH

#### H1: `check_ins` upsert relies on missing UPDATE policy
- **File:** supabase/migrations/20260523120005_check_ins.sql:21-25 + lib/actions/checkin.ts:88-96, 132-140, 212-220
- **What:** `check_ins` has SELECT + INSERT policies but no UPDATE policy. `acknowledgeAccount` and `flagAccount` use `upsert(..., { onConflict: ... })`. If the user already has a row for today, the upsert triggers an UPDATE that RLS denies (error 42501).
- **Why it matters:** A user who flags an account they earlier acknowledged (or any double-action) gets a hard error. Likely silent in dev because no one re-actions same day; will surface for real users.
- **Fix:** Add `CREATE POLICY "Users update own check-ins" ON public.check_ins FOR UPDATE USING (auth.uid() = user_id);` (and the workspace-cross-check variant in the workspaces migration).

#### H2: `acknowledgeAccount` updates account row by `user_id` only — workspace teammates' acks silently no-op
- **File:** lib/actions/checkin.ts:99-103
- **What:** Update filters on `eq('id', accountId).eq('user_id', user.id)`. Accounts are now workspace-scoped — the row's `user_id` is whoever created it, not the current user. A workspace member acknowledging a teammate's account hits the filter, returns 0 rows, no error.
- **Why it matters:** Multi-user workspaces (Task 3.1) silently break check-ins for non-creator members. `last_acknowledged_at` never updates, decay state stays stale, no UX feedback.
- **Fix:** Drop the `user_id` filter and rely on RLS (workspace membership). Same pattern as `editAccountBalance` at line 198.

#### H3: Ask Vigilance daily cap is TOCTOU-racy
- **File:** lib/actions/ask.ts:116-128, 223-229
- **What:** Count → conditional → LLM call → insert. Two concurrent requests both see `usedToday < 5`, both call Claude, both insert. Cap can be exceeded by N parallel tabs.
- **Why it matters:** $0.006/call is small per leak but exposes a denial-of-funds vector: a single user can script N parallel requests and break the cost budget for the day.
- **Fix:** Use a row-level lock (insert a row with a unique constraint on `(user_id, utc_day)` count, or do the LLM call inside a Postgres function with `for update`). Or move to "insert pending row, count = N+1, then call Claude; rollback on cap".

#### H4: `inviteMember` doesn't email the invitee — owner copies URL manually
- **File:** lib/actions/workspaces.ts:99-134
- **What:** Returns the `inviteUrl` to the owner; comment at line 127 says "until Resend is wired, the owner copies this URL". Resend IS now wired (lib/email/send.ts) but invite emails aren't.
- **Why it matters:** Invite flow has shipped to prod but requires out-of-band delivery. Owners will think it's broken; invitees never know they were invited.
- **Fix:** Add a `WorkspaceInviteEmail.tsx` component and call `sendEmail({...})` from `inviteMember` (best-effort, return inviteUrl as fallback for log/copy).

#### H5: Re-engagement decay (14d) uses naive Date math — TZ off-by-one for users in the West
- **File:** app/api/cron/sunday-reckoning/route.ts:79-86 + lib/decay.ts (likely)
- **What:** `(Date.now() - last.getTime()) / 86400000 >= 14`. `last_checkin_date` is a DATE; new Date("2026-05-12") becomes midnight UTC. A user in PT who last checked in on 2026-05-12 local will hit "14 days ago" at a different wall-clock than expected.
- **Why it matters:** Day 14 (Sunday) email might skip them or hit them a day early; mostly benign but the math intent says "skip if 14d+ idle" and the implementation is fuzzy.
- **Fix:** Compute both timestamps as UTC dates and floor diff to integer days, or move the check to a SQL fragment using `current_date - last_checkin_date >= 14`.

#### H6: `dismissHint` updates by `user_id`, not workspace — same teammate-bypass as H2
- **File:** lib/actions/hints.ts:21-39
- **What:** Both the read and the update use `.eq('user_id', user.id)`. After workspace migration, hints belong to the workspace; another member dismissing a hint hits 0 rows.
- **Why it matters:** In multi-user workspaces, only the original "owner" of a hint can dismiss it. UI shows hint as still active; users get confused.
- **Fix:** Drop `eq('user_id', ...)`; RLS workspace membership covers authorization.

#### H7: `resolveHint` same workspace-scope bug as H6
- **File:** lib/actions/hints.ts:53-61
- **Same root cause as H6.** Resolve action is gated by creator's user_id rather than workspace membership.
- **Fix:** Drop the user_id filter.

#### H8: `disconnectPlaidItem` archives accounts but doesn't `revalidatePath('/app/checkin')` — orphaned daily-checkin entries
- **File:** lib/actions/settings.ts:96-119
- **What:** Disconnect archives accounts but only revalidates `/app` and `/app/settings`. Today's check-in page caches the account list; archived accounts may remain visible until next route hit. Also: dependent `hints` referencing the archived accounts are not marked stale.
- **Why it matters:** UX inconsistency. User disconnects bank, goes to check-in, sees the account they just disconnected as still requiring acknowledgement.
- **Fix:** Add `revalidatePath('/app/checkin')` and `revalidatePath('/app/hints')`. Consider muting related hints.

#### H9: Plaid webhook iterates `res.data.accounts` and calls `admin.from('accounts').select().eq('plaid_account_id', a.account_id)` without workspace_id scope
- **File:** app/api/plaid/webhook/route.ts:148-153
- **What:** Lookup uses `workspace_id = item.workspace_id` AND `plaid_account_id`. That IS scoped. But: if a single Plaid account_id ever collides across workspaces (re-link to different bank with same Plaid ID), the wrong row gets updated.
- **Why it matters:** Cross-workspace data corruption risk — vanishingly unlikely but service-role makes it silent if it happens.
- **Fix:** Add `eq('plaid_item_id', plaidItemRowId)` to the lookup, double-scoping by item AND plaid_account_id.

---

### MEDIUM

#### M1: Marketing copy claims user-controlled Supabase keys
- **File:** app/(marketing)/page.tsx:307-310
- **What:** "Your financial data lives in a Supabase project we provision for you. You control the keys."
- **Why it matters:** Factually wrong — it's a shared Revarity Supabase project with RLS; users do not provision projects and do not hold keys. Reads as misleading on a Trust section. Plaid disclosure scrutiny would catch this.
- **Fix:** Reword to "Your data is row-isolated in our database. You can export or delete it at any time."

#### M2: Projection math double-counts debt trend
- **File:** lib/projection.ts:106-129
- **What:** `slopeContribution = dailySlope * d` already reflects historical net-worth trend (which includes whatever debt paydown happened in the 90-day window). Then `amortBenefit = initialDebtTotal - projectedDebtTotal` adds a second lift from min_payment paydown.
- **Why it matters:** Net-worth projection overstates growth for any user with active debt. Year-1 projection in particular shows wildly optimistic numbers.
- **Fix:** Either project debt independently (slope from assets-only) or skip amortBenefit when slope already trends positive.

#### M3: Projection infinite-stall edge case (min_payment ≤ interest)
- **File:** lib/projection.ts:117-122
- **What:** `principal = Math.max(0, ds.minPayment - interest)`. When minimum payment < monthly interest (common on revolving credit at high APR), principal is 0 and balance never decreases. Loop is bounded by months but `projectedDebtTotal === initialDebtTotal` so `amortBenefit = 0` — fine numerically, but the user's "Where you're heading" chart shows the projection as if their debt won't grow. Real debt grows from negative amortization.
- **Why it matters:** Misleads users with high-rate credit cards into thinking minimum payments are containing their debt.
- **Fix:** When principal would be ≤ 0, model the balance growing by `(interest - minPayment)` each month and reflect in projection.

#### M4: Plaid webhook handler treats any non-existent `item_id` as success (200)
- **File:** app/api/plaid/webhook/route.ts:62-71
- **What:** Returns `{ ok: true }` when no plaid_items row matches. Plaid considers a webhook "delivered" and won't retry.
- **Why it matters:** If a race between exchange and webhook delivery causes a near-instant webhook before the row commits, we silently lose that event (typically a HOLDINGS update). Sandbox is fine; production could miss the first balance update for fresh links.
- **Fix:** Return 503 (or 202) for unknown item_ids so Plaid retries with backoff. Add a metric for this branch.

#### M5: `editAccountBalance` and `updateAccountBalance` write 1.0 fx_rate for non-USD too if home currency isn't USD
- **File:** lib/actions/checkin.ts:202-209 + lib/actions/accounts.ts:157-163 + app/api/plaid/exchange/route.ts:131-138 + app/api/plaid/sync/route.ts:79-86
- **What:** `fx_rate: account?.currency === "USD" ? 1 : null`. Hardcodes USD as home currency. A user with home_currency = "CAD" and a CAD account gets `fx_rate = null` even though it should be 1.0.
- **Why it matters:** Day-6 FX cron logic will treat these rows as "needs FX backfill" forever and waste API calls; net-worth math currently bypasses FX entirely (`balance_home_currency = balance`) so the bug is dormant but baked in.
- **Fix:** Compute against `profile.home_currency`, not the hardcoded "USD".

#### M6: H-001 hint uses `worst.apr.toFixed(2)` without bounds check on negative or absurd APRs
- **File:** lib/hints/H-001-debt-priority.ts:23-43
- **What:** Hint copy interpolates `apr.toFixed(2)` directly. If a user manually enters a typo like APR=999, the hint reads "Your card charges 999.00% a year".
- **Why it matters:** Low impact but undermines voice when it fires on garbage data. Also: H-001's `reduce` without initial value throws on empty list — actually fine here because the filter at line 18 returns early if `debts.length === 0`.
- **Fix:** Clamp `apr` to [0, 100] for display, or skip the hint and surface a "this APR looks off" hint instead.

#### M7: `composeCopy` retry/error model is silent — Ask Vigilance loses budget on transient failures
- **File:** lib/actions/ask.ts:212-220 + lib/anthropic.ts:19-37
- **What:** Try/catch catches the LLM throw and returns ok:false. But the `usedToday` budget is computed BEFORE the LLM call and the failure path skips inserting the history row, so budget IS preserved correctly. However, a partial success (LLM returns text but history insert fails at line 230) DOES consume budget on the next request because `ask_history` row exists. Not great if the user retries.
- **Why it matters:** Hard to reason about budget; a flaky DB hiccup eats a question slot silently.
- **Fix:** Surface insert failure to the user as a soft warning, or move the history insert before the LLM call (eats a slot up front, predictable).

#### M8: `decay_warnings_enabled` toggle saves to profile but UI shows takeover anyway during the in-flight transition
- **File:** app/app/page.tsx:138-147 + components/ReengageTakeover.tsx
- **What:** Toggling the setting off doesn't immediately suppress the takeover because the page is server-rendered; user has to wait for `revalidatePath`. Toggle currently doesn't revalidate `/app`.
- **Fix:** Add `revalidatePath('/app')` to `toggleProfileFlag` in lib/actions/settings.ts:77-85.

---

### LOW

#### L1: AccountRow prepends "−" for any debt regardless of stored sign
- **File:** components/AccountRow.tsx:83
- **What:** If a debt account's `balance` happened to be stored negative (manual entry of `-500`), display would render `−−$500`.
- **Fix:** Wrap balance in `Math.abs` before formatBalance, or rely solely on the sign from formatBalance.

#### L2: H-001 dedup is per-account but H-001 only fires for the "worst" debt
- **File:** lib/hints/H-001-debt-priority.ts + lib/hints/engine.ts:104
- **What:** dedupKey is `templateId::relatedAccountId`. When the worst debt changes (user pays one down, another becomes the highest APR), a new hint fires for the new worst — fine. But the old one stays active until manually dismissed. Multiple H-001s can pile up.
- **Fix:** When inserting H-001, mute any prior active H-001 for the same workspace.

#### L3: Ask Vigilance "remaining today" math is slightly wrong on cap-hit
- **File:** lib/actions/ask.ts:240-241
- **What:** `Math.max(0, DAILY_CAP - ((usedToday ?? 0) + 1))`. If a user races multiple inserts (see H3), one will get `remainingToday: -1` clamped to 0, but they actually inserted past the cap.
- **Fix:** Re-count after insert.

#### L4: `composeCopy` system-prompt forbids disclaimers but app has no global disclaimer mounted
- **File:** lib/actions/ask.ts:36-38 + lib/anthropic.ts:67-70
- **What:** System prompt says "the app handles disclaimers globally" — no global disclaimer anywhere in the layout. If user asks for advice and the model complies (which the prompt encourages by removing the safety net), there's no fallback.
- **Fix:** Either add a footer disclaimer near "Ask Vigilance" CTAs, or remove the "app handles globally" clause from the prompt and let the model add its own caveats.

#### L5: `app/app/accounts/[id]/account-detail-client.tsx:441` says "What banks call APR"
- **File:** app/app/accounts/[id]/account-detail-client.tsx:441
- **What:** Tooltip explicitly translates a forbidden term. The implementation is good (the label says "Yearly interest"), the tooltip clarifies via the jargon word. Borderline OK but THESIS's audit prompt flagged "APR" as forbidden in user-facing copy.
- **Fix:** Tooltip could say "the % you pay on a year's balance" without naming "APR".

#### L6: `parseScotiaCsv` is RFC-4180-broken on quoted commas
- **File:** lib/actions/csv-import.ts:32-68
- **What:** Naive split-on-comma; a transaction description containing `,` ("Coffee, milk, sugar") breaks the row count and likely skips the row. Function tolerates skipping but silent data loss is jarring.
- **Fix:** Use a proper CSV parser (papaparse, csv-parse) or document the limitation in the upload UI.

#### L7: `lib/email/send.ts` returns sent:false when key not set — cron handler can't distinguish "wasn't configured" from "send failed"
- **File:** lib/email/send.ts:32-35
- **What:** Both branches return `sent: false` with a `reason`. Cron logs aggregate as "failures" indistinguishably. After Cena adds RESEND_API_KEY, the first cron run looks failed even though everything skipped cleanly.
- **Fix:** Return a third state like `{ skipped: true, reason: "no_key" }`.

---

### NICE-TO-HAVE

#### N1: `crypto.randomBytes` for invite token is fine but invite tokens lack expiration
- **File:** lib/actions/workspaces.ts:111 + supabase/migrations/20260526120002_workspaces.sql:32-49
- Tokens are 48-char hex, fine. Tokens never expire — once leaked, valid forever. Consider a 7-day expiry on the invite.

#### N2: No rate limit on `/api/plaid/link-token`
- **File:** app/api/plaid/link-token/route.ts
- Auth-only, but a logged-in user can spam it to drain Plaid Link quota.

#### N3: `app/app/subscriptions/page.tsx` ships an empty state that says "Plaid Recurring Transactions"
- **File:** app/app/subscriptions/page.tsx:70-73
- The phrase "Plaid's recurring transactions feed" might confuse non-technical users. Consider "we're adding subscription detection once our bank-data partner enables it for us".

#### N4: `vault_get_secret` SECURITY DEFINER trusts its input UUID
- **File:** supabase/migrations/20260526120001_plaid_token_vault.sql:35-53
- Only granted to service_role, so the trust boundary is the admin client. If a future bug exposes an admin RPC call that takes a user-controlled UUID into this function, decryption is fully untrusted-input controlled. Acceptable today; worth a comment block.

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
- Email templates (MagicLinkEmail/SundayReckoningEmail/MonthlyCloseEmail .tsx files)
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
