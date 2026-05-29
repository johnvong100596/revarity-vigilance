# How to apply the pending DB migrations

These migrations exist as files but have NOT been applied to any database — I
don't run migrations against prod. Apply them yourself with the steps below.
**Test the RLS one in a branch first** (a bad RLS policy can lock users out).

## The pending migrations
On **master** (merged):
- `20260529120001_billing_subscriptions.sql` — `stripe_customers` + `subscriptions` tables. Safe (empty tables). Prod runs fine without it; needed before billing goes live.

On **`feat/billing-rules-fx-rls`** (not merged yet):
- `20260529120002_workspace_rls_hardening.sql` — tightens workspace member policies. **TEST FIRST.**
- `20260529120003_revarity_free_operator.sql` — gives @revarity.com emails free business features (new signups + backfill).

(The `fx_rates` table already exists from an earlier migration; the FX feed just needs the `fx-refresh` cron to run.)

---

## Recommended: Supabase CLI

```bash
# from the repo root
npx supabase login                       # opens a browser to authenticate
npx supabase link --project-ref <REF>    # REF is in your Supabase dashboard URL / Project Settings → General
```

### Step 1 — test on a branch (do this for the RLS migration)
```bash
npx supabase branches create test-migrations   # spins up an isolated copy
# push to the branch and smoke-test:
npx supabase db push --branch test-migrations
```
On the branch, verify:
- An **admin** can NOT set a member's role to `owner`, and can NOT delete the owner's row.
- An **owner** can still manage everyone; a member can still leave.
- A fresh `@revarity.com` signup lands with business features on (is_operator true) + a "Personal" entity.

### Step 2 — apply to production
```bash
npx supabase db push        # runs all pending migrations in timestamp order against the linked (prod) DB
```

### Step 3 — verify prod
- Tables exist: `subscriptions`, `stripe_customers`.
- `select id, is_operator from profiles` shows your @revarity.com accounts as `is_operator = true`.

---

## Alternative: Supabase Studio SQL editor (no CLI)
Dashboard → SQL Editor → paste each migration's SQL **in timestamp order**
(`...120001`, then `...120002`, then `...120003`) → Run each.

⚠️ Caveat: this does NOT record the migration in Supabase's `schema_migrations`
history, so a later `supabase db push` may try to re-run them. The files are
written idempotently (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `ON CONFLICT`)
so a re-run is safe — but the CLI path keeps history clean and is preferred.

---

## After migrating
- **FX feed:** trigger the rate feed once so multi-currency conversion has data:
  `curl -H "Authorization: Bearer $CRON_SECRET" https://vigilance.revarity.com/api/cron/fx-refresh`
  (or wait for the daily 05:00 UTC cron). Until it runs, `fx_rates` is empty and
  balances display in native currency (no conversion) — safe, just not converted.
- **Stripe:** parked per your call. When ready: create the product/price, set
  `STRIPE_SECRET_KEY` / `STRIPE_OPERATOR_PRICE_ID` / `STRIPE_WEBHOOK_SECRET`,
  and point a Stripe webhook at `/api/billing/webhook`.
