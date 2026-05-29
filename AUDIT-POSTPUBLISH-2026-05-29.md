# Post-Publish Audit — 2026-05-29 (after go-live)

Ran 4 parallel agents over the newly-live code (FX, billing, RLS/revarity, regression).
**Reassuring headline: no crashes, prod is stable, and the RLS + signup-trigger
migrations are confirmed SAFE in prod** (signup not broken, no legitimate flow
blocked). Fixed the safe high-value bugs; flagged the rest for you.

---

## FIXED this round (live on master, build green)

- **fx_rates overflow (FX C1, CRITICAL)** — `rate` was `NUMERIC(10,6)` (max 9999.99…). USD→PYG is ~7300 and rising; crossing 10000 would 500 the whole feed. Widened to `NUMERIC(18,8)` (migration `20260529120004`, applied to prod).
- **Revarity comp clobber (Billing #1, CRITICAL)** — webhook would flip `is_operator=false` for a comped @revarity.com user who ever subscribed+cancelled. Now the webhook never revokes operator for an @revarity.com email. (Dormant until Stripe, but fixed.)
- **Projection chart showed raw native sums (FX H1)** — `ProjectionChart` got un-normalized `accounts`, so a ₲50M account read as "$50M". Now passed `accountsHome`. (Historical snapshot line still native — see flagged.)
- **Pay-this-week amounts (FX H2)** — `buildUpcomingPayments` used native `min_payment` under a home-currency label (₲200,000 → "$200,000"). Now uses `accountsHome`.
- **"FX rates pending" chip stuck on (FX H3 / regression L1)** — was keyed on raw currency diversity, so it showed even when conversion worked. Now keyed on actual conversion outcome (a row still foreign after normalize = rate missing).
- **Webhook 500-retry loop (Billing #2)** — an unresolvable subscription now skips with 2xx instead of throwing (which made Stripe retry for days). `checkout.session.completed` now re-syncs the subscription once the customer mapping lands.
- **Entitlement "newest sub" bug (Billing #4)** — `getEntitlement` now matches ANY active sub, not just the newest row.
- **Checkout customer race (Billing #5)** — on a 23505 the loser now uses the winning customer id instead of an orphan.
- **Stale cron comments (regression M1)** — removed the "don't alias GET" comments that contradicted the now-correct GET handlers (a re-introduce-the-bug landmine).

---

## FLAGGED — for you (not fixed; product decision or needs care)

### 1. ⚠️ The paid tier is currently FREE-bypassable (Billing #6) — decide before Stripe goes live
`lib/actions/operator.ts` `setOperator` lets ANY signed-in user toggle
`profiles.is_operator = true` from Settings, and `profiles` RLS has no column
guard on `is_operator`. So once billing matters, anyone can grant themselves the
business tier for free by flipping the Settings toggle — bypassing Stripe
entirely. **Not fixed now because** billing isn't live yet, and gating the
toggle today would lock every non-revarity user out of the operator features
they currently toggle freely. **When you wire Stripe:** gate/remove the toggle
for non-entitled users and add a `profiles` WITH CHECK (or column grant) so
`is_operator` can't be self-set. This is the #1 thing to settle before charging.

### 2. Deferred snapshot-FX (still native currency)
Net worth, runway, pay-this-week, and the projection's *current* value are now
converted. Still native (need HISTORICAL rates, not just latest):
- Week-over-week net-worth delta (`app/app/page.tsx`) — converted "now" minus native "week ago".
- Projection chart's historical trend line (`snapshots90d`).
- Sunday Reckoning / Monthly Close email change-figures (`lib/rituals.ts`, cron routes).
Right fix: store a converted `balance_home_currency` on each `balance_snapshots`
row at capture time, then read that. Single-currency users are unaffected today.

### 3. Webhook event ordering / idempotency (Billing #3)
No `event.id` dedupe and writes trust delivery order; a late stale event could
resurrect a cancelled sub. Dormant (no Stripe). Add an event-id dedupe or a
"only apply if newer" guard before go-live.

### 4. FX feed robustness (FX M4 / M5)
`fx-refresh` delete-then-insert isn't atomic (a crash mid-run empties the day's
feed) and a partial provider response persists an incomplete feed (then
`normalizeAccountsToHome` silently leaves some balances native and the sum
blends — mitigated now by the always-present rows + the honest "pending" chip).
Harden: do delete+insert in one transactional RPC and require the full currency
set before committing. Note: `EXCHANGERATE_API_KEY` exists in env — could move
to the authenticated endpoint for reliability.

---

# Round 3 (deeper sweep: a11y, performance, onboarding/email)

## FIXED this round
- **🔴 CRITICAL self-inflicted regression — new signups were broken (redirect loop).** My `20260529120003_revarity_free_operator` migration redefined `handle_new_user()` from the original profiles-only version and dropped the workspace-creation logic a later migration had added — so new users got `active_workspace_id = NULL` → `/app`↔`/login` loop. Also dropped `referral_token`. **Fixed in prod** via `20260529120006`: restored workspace + referral_token + kept the revarity comp, and backfilled any window-affected users. Verified: 0 profiles without a workspace, 0 without a referral_token. (This is the most important catch of the night.)
- **fx_rates query unbounded scan (perf H2)** — `makeRateResolver` now bounds to the last 7 days.
- **Missing composite index (perf L1)** — added `idx_balance_snapshots_workspace_date` (migration `20260529120005`, applied).

## FLAGGED — accessibility (needs a focused design pass with Cena; the "anyone can use it" bar)
The full report is detailed; the high-impact items, NOT auto-fixed because they're
design-system/brand decisions (colors, type scale):
- **Contrast fails WCAG AA**: `text-muted` #8C8C8C (3.0–3.4:1), the accent #F04E37 for button text/links (3.59:1), decay-warning, crypto colors. Older eyes can't reliably read core copy + CTAs.
- **Type too small**: `text-[10px]`/`text-[11px]` on essential content incl. the check-in swipe legend (the core daily ritual) and trust microcopy.
- **Hover/`title`-only content invisible on touch** (the primary platform): the entire "Net worth" definition, account-field explanations, and the "how to fix a wrong APR" instruction.
- **Tap targets < 44px**: header nav icons, the settings toggle, text-link actions.
- **Color-only meaning**: utilization bar, net-worth delta, decay dot (colorblind/low-vision can't distinguish).
- **Forms**: login + check-in inputs lack `<label>`/`aria-label`; errors aren't `role="alert"` (a blind user gets no feedback on a bad code).
- **WelcomeMoment** full-screen takeover has no dialog semantics, focus trap, or dismiss control (timer-only); no `prefers-reduced-motion` anywhere.

## FLAGGED — performance (optimizations; not urgent at zero users)
- Cron routes: O(users) `getUserById` + per-user N+1 queries — batch before scaling.
- `makeRateResolver` re-queried per request (page + hints engine) — wrap in `cache()` / TTL.
- `select("*")` on the wide `accounts` table in 4 hot paths.
- Home page: FX + operator `entities`/`ious` could fold into the first `Promise.all` (−2 serial hops).

## FLAGGED — onboarding & email
- **Email deliverability**: no `List-Unsubscribe` header (Gmail/Yahoo bulk rules → spam risk) and the opt-out is buried prose, not a link.
- **DMARC**: `from` is `noreply@revarity.com` but links are `vigilance.revarity.com` — verify Resend/DNS authorizes the apex `revarity.com` for SPF/DKIM/DMARC, or switch the sender to the subdomain. (Needs a DNS check.)
- **@revarity.com first-run**: comped users land with business UI (entities/runway/IOUs) and no explanation of why a personal-finance app shows "your businesses."
- `scripts/render-emails.mjs`: in-file `node` usage instruction won't run a `.tsx` import; use `npm run render-emails` (tsx). Make the docs consistent.
- Login "Resend" gives no visible confirmation a new code was sent.
- Confirm `NEXT_PUBLIC_SITE_URL` is set in Vercel prod (email links fall back to a hardcoded URL otherwise).

---

### 5. Still-open from the first audit (AUDIT-AUTONOMOUS-2026-05-29.md)
Plaid sync never reconciles accounts; balances stored as `Math.abs` lose sign;
`account_type` maps Plaid `credit`→`loan`; `profiles` UPDATE policy allows
referral-credit / streak tampering; H-304 hint unregistered; etc. Unchanged.
