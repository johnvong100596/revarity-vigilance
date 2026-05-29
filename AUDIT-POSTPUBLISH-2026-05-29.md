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

### 5. Still-open from the first audit (AUDIT-AUTONOMOUS-2026-05-29.md)
Plaid sync never reconciles accounts; balances stored as `Math.abs` lose sign;
`account_type` maps Plaid `credit`→`loan`; `profiles` UPDATE policy allows
referral-credit / streak tampering; H-304 hint unregistered; etc. Unchanged.
