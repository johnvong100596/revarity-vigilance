# SESSION-STATE — autonomous overnight run

**Operator:** Cena (away for the night — work autonomously, do not wait).
**Started:** 2026-05-28 night → 2026-05-29.
**Mode:** /remote-control, branch-only, no merges/pushes to main, no paid APIs, no money, no destructive ops.

## Git state
- **Working branch (this run):** `feat/saas-billing-entitlements` — created off `master` so `feat/today-home-screen` stays clean for Cena's review.
- **master HEAD:** `9fefca6` — Login: 6-digit OTP code path (LIVE IN PROD).
- **feat/today-home-screen HEAD:** `eae5665` — home-screen hero (PUSHED PREVIEW, NOT MERGED, awaiting Cena's verdict).

## Mandate (from Cena tonight)
1. SaaS threads in IDEAS-VIGILANCE-SAAS.md — **#1 positioning** + **#2 Stripe billing & entitlements**. Stripe = code/schema scaffolding ONLY (no paid API calls, no live products, no money).
2. **Audit everything** — find bugs/faults, log them, rerun verification (tsc + lint + build) multiple times, adjust accordingly.

## Verification gate (must pass before any task counts done)
`npx tsc --noEmit && npx next lint && npx next build`

---

## Overnight publish session (Cena authorized go-live, 2026-05-29) — current
- **POST-PUBLISH AUDIT round done** (4 parallel agents). No crashes; prod stable; RLS + signup-trigger confirmed safe in prod. Fixed 9 bugs (live on master), flagged the rest → AUDIT-POSTPUBLISH-2026-05-29.md.
  - Fixed: fx_rates overflow (widened NUMERIC(18,8), applied to prod); revarity-comp clobber guard in webhook; projection + pay-this-week now use converted balances; "FX pending" chip keyed on real conversion outcome; webhook 500-retry loop → 2xx + re-sync; entitlement any-active; checkout customer race; stale cron comments removed.
  - **TOP FLAG for Cena before charging:** the operator/business tier is currently FREE-bypassable — anyone can toggle is_operator on in Settings (setOperator + no profiles column guard). Must gate before Stripe go-live. Not fixed now (would lock out current non-revarity operator users while billing is dormant).
  - Other flags: deferred snapshot-FX (week-over-week delta / projection history / emails still native); webhook event-ordering; fx feed atomicity. See audit doc.

- **PUBLISHED to prod:** merged `feat/billing-rules-fx-rls` → master (ff) and pushed → Vercel deploy. Multi-currency FX, @revarity.com free tier, workspace RLS hardening, and 30-day trial are now in the prod codebase.
- **Applied all 3 pending DB migrations to PROD** via `scripts/apply-migration.mjs` (the team's existing runner; transactional). Verified:
  - subscriptions + stripe_customers tables exist (empty/dormant).
  - @revarity.com backfill: 3/3 revarity users → is_operator=true.
  - workspace_members UPDATE policy now has WITH CHECK (takeover chain closed).
  - fx_rates seeded (USD/CAD/EUR/PYG) so FX conversion works immediately.
- Cena's directive: publish even if buggy ("no one using it"), flag all bugs/faults for tomorrow. Running a heavy parallel re-audit of the newly-live code (FX, billing, RLS/revarity, regression) — findings → AUDIT doc + fixes.
- **KNOWN-OPEN flagged already:** (1) deferred snapshot-FX (projection/week-over-week still native — needs historical rates). (2) Stripe keys not set (billing dormant by design). (3) revarity-comp clobber risk: if a comped @revarity.com user ever subscribes+cancels, the webhook would flip is_operator off — auditing.

## Follow-up session (Cena live, 2026-05-29)
- **MERGED to master (prod):** `feat/saas-billing-entitlements` fast-forwarded → master @ `231f454`'s parent line; pushed. Fixes the live cron + Ask bugs; billing rides along dormant. (Billing migration `20260529120001` is on master but NOT applied to prod DB — apply when wiring Stripe; prod is safe without it.)
- **New branch `feat/billing-rules-fx-rls`** (off updated master) — NOT merged, pushed for review:
  - @revarity.com emails → business features free (migration `..._revarity_free_operator`: handle_new_user + backfill). Everyone else → 30-day Stripe trial (checkout `trial_period_days=30`) then paid.
  - Workspace RLS hardening (migration `..._workspace_rls_hardening`) — closes the admin→owner takeover chain. **TEST in a Supabase branch before applying.**
  - Multi-currency FX: rate-feed cron + resolver + net-worth conversion. Safe (no behavior change until the feed populates). **Needs Cena's runtime review** of displayed numbers before merge; runway/projection/hints still mix currencies (queued).
- Decisions taken from Cena: price $15/mo or $120/yr · 30-day trial · no Stripe keys yet · FX via free provider (Google has no API) · RLS go · Vu renames later · E done.

## Progress log
- [done] Baseline tsc/lint/build all green on master @ 9fefca6.
- [done] #2 Stripe billing + entitlements scaffolding (code only, no Stripe calls/keys/money).
- [done] Full six-track audit complete; full findings in AUDIT-AUTONOMOUS-2026-05-29.md.
- [done] Applied safe, high-confidence bug fixes from the audit. tsc + lint + full build all GREEN after fixes (verified end-to-end).
- [done] #1 positioning operationalized → POSITIONING-AND-PRICING-2026-05-29.md (free-vs-paid boundary, pricing recommendation, Vu-test naming direction).
- **RUN COMPLETE.** All work is on branch `feat/saas-billing-entitlements` (off master). Nothing merged, nothing pushed, no prod/DB/Stripe changes. 3 commits. tsc + lint + build green. Awaiting Cena.

### Audit fixes applied this run (commit pending)
- **CRITICAL** cron never fired: `sunday-reckoning` + `monthly-close` now export GET (delegates to POST) so Vercel Cron actually runs them; CRON_SECRET check preserved on both verbs.
- **CRITICAL** "Ask Vigilance" broken for everyone: fixed `type`→`account_type` column; roll back the quota placeholder on the no-accounts path.
- runway divide-by-near-zero → absurd days: sub-1-unit burn treated sustainable + 100yr cap.
- H-002 credit payoff figure floored at 0 (was renderable negative).
- fx.ts: guard direct-rate isZero (was silently zeroing balances).
- addAccount: revalidatePath("/app") so a new account shows immediately.
- Hydration: suppressHydrationWarning on the two client time-format nodes (settings last-sync, reckoning saved-at).
- Vu-test copy (safe dev-jargon leaks only): "the model", "midnight UTC", "Day 6 cron lands the live rate feed", "skip the hint engine entirely" → plain English.

## Done
### #2 Billing + entitlements scaffolding (commit pending)
- `supabase/migrations/20260529120001_billing_subscriptions.sql` — `stripe_customers` + `subscriptions` tables, RLS (user reads own; writes service-role only).
- `lib/stripe.ts` — lazy server-only Stripe client, `isBillingConfigured()`, fail-soft (no keys → routes 503, no crash).
- `lib/entitlements.ts` — `getEntitlement()` resolves paid-sub vs comp vs free in one place.
- `app/api/billing/{checkout,portal,webhook}/route.ts` — checkout session, billing portal, signature-verified webhook. Webhook flips `profiles.is_operator` to match paid status → every existing operator gate respects billing with ZERO gate-code changes. Idempotent upserts; 500-on-error so Stripe retries.
- `components/BillingSection.tsx` + wired into `app/app/settings/page.tsx` — plain-English plan card, dormant until Stripe configured.
- Added `stripe@22` dependency. tsc + lint clean.
- **Did NOT:** call any Stripe API, set any keys, create any products, or spend money. Pure code.

## NEEDS CENA (decisions only Cena can make — not guessing)
- **Pricing for the operator tier** (#2): monthly/annual price, trial length, exact free-vs-paid boundary. Scaffolding uses env-var price IDs; final numbers are yours. To go live: create the product/price in Stripe, set `STRIPE_SECRET_KEY`, `STRIPE_OPERATOR_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, and point a Stripe webhook at `/api/billing/webhook`. Until then billing is dormant (no UI, routes 503).
- **Audit — high-impact items I would NOT fix unsupervised** (full detail in AUDIT-AUTONOMOUS-2026-05-29.md):
  - Multi-currency net worth/runway summed without FX (intentionally deferred to "Day 6"). Biggest correctness risk. Ship FX or gate runway/portfolio hints to single-currency until then.
  - Plaid sync never reconciles accounts (closed accts keep stale balances; new accts never appear) + webhook not idempotent (duplicate snapshots) + webhook returns 200 on error (no retry).
  - Workspace takeover chain: admin can self-promote to owner + evict owner (RLS WITH CHECK gap). Recommended SQL in the audit doc — review + test before applying; I did NOT write a migration.
  - `account_type` maps Plaid `credit`→`loan` (cards look like loans) — needs enum migration.
  - H-304 subscription-burn hint written but unregistered; `bank_products` table + H-102 unbuilt; dead `capital_waterfall`/`role_context` columns.
  - Core nav Vu-test renames (Reckoning, Monthly Close, unexplained "Net worth", marketing-page jargon) — brand decision, not auto-fixed.
  - Optimistic check-in advances the queue even when the server action throws (silent data loss) — interaction-flow change.

## Open questions / notes
- The /remote-control scoped-task slot arrived blank (literal template placeholder). Proceeding on the clearly-scoped independent work from the prior briefing (#1/#2 + audit), since the feat/today-home-screen merge is gated on Cena's verdict and branch-only forbids the merge regardless.
- `is_operator` column exists (migration 20260528120001) but an initial grep found **zero code references** — possible unwired gating. Flagged for audit.
