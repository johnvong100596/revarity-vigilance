# Blockers — night batch 2026-05-26

Items that need a human (Cena) to complete because they involve
external service configuration, dashboard pastes, or new credentials
I don't have. Each is grouped with the task that originated it; the
code side of every blocker is fully shipped.

---

## Task 1.4 — Custom magic-link email

**What I shipped:** `lib/email/MagicLinkEmail.tsx` + rendered output
at `lib/email/templates/magic-link.html`. `npm run render-emails`
regenerates the HTML when the design changes.

**What you do:**
1. Open `lib/email/templates/magic-link.html` and copy the entire file
2. **Supabase Dashboard → Authentication → Email Templates → Magic
   Link** → switch to "Source" view → paste → Save
3. **Subject line:** change to `Your Vigilance sign-in link`
4. **(Optional, premium polish):** to send from `noreply@revarity.com`
   instead of Supabase's default `noreply@mail.app.supabase.io`,
   configure a custom SMTP provider in Supabase Auth → Settings →
   SMTP Settings. Easiest path: Resend SMTP relay
   (`smtp.resend.com:587`, requires verifying revarity.com DNS in
   Resend first). Without this step, Vigilance emails ship from
   Supabase's default sender and may land in Promotions tab — not
   broken, just less premium.

---

## Tier 2 transactional emails — requires Resend setup

**What I'll ship:** `lib/email/SundayReckoningEmail.tsx` +
`lib/email/MonthlyCloseEmail.tsx` + cron route handlers in
`/api/cron/sunday-reckoning` and `/api/cron/monthly-close` + send
logic using `resend` SDK.

**What you do (before any user actually receives these):**
1. Sign up at <https://resend.com> (free tier covers 3,000 emails/mo)
2. Verify `revarity.com` domain — Resend will give you 3 DNS records
   to add at GoDaddy (DKIM, SPF, MX or DMARC)
3. Generate an API key in Resend dashboard
4. Add to Vercel env vars (Production scope): `RESEND_API_KEY`
5. Configure Vercel Cron at `vercel.json` (already scaffolded by my
   code). Confirm Vercel project plan supports Cron (Hobby plan
   allows 2 cron jobs; we have 2)

---

## Plaid webhook JWT verification — needs Plaid prod environment ack

**What I'll ship:** webhook signature verification using Plaid's
`webhookVerificationKeyGet` endpoint per their docs at
<https://plaid.com/docs/api/webhooks/webhook-verification/>.
Implementation is straightforward — pull JWT from
`plaid-verification` header, fetch the key by `kid` claim, verify
signature against payload SHA-256.

**Possible issue:** verification requires the webhook URL registered
in Plaid Dashboard to match our actual endpoint, AND the request to
originate from Plaid's IP range. If you've not yet added
`https://vigilance.revarity.com/api/plaid/webhook` to your Plaid
Dashboard webhook config, do that now — link is
<https://dashboard.plaid.com/team/api>.

---

## Plaid Canada — needs account-level Country access in Production

**Reported bug (2026-05-26):** Plaid Link rejects Canadian +1 phone
numbers on the returning-user phone enrollment screen.

**Code status: NOT the cause — already correct.** The Link token is
created with `country_codes: ['US', 'CA']` (`LINK_COUNTRY_CODES` in
`lib/plaid.ts`, used by `app/api/plaid/link-token/route.ts`). Products
are `transactions` + `liabilities` + `investments` (no `auth`, which
is the product that would force US-only when CA is included). Language
is `en`. This has been in the code since BUILD 6 (commit 820f731,
2026-05-25). No code change is needed or possible to fix this further.

**Actual blocker — Plaid Dashboard:** the `country_codes` request only
takes effect if Canada is enabled at the account level for the active
environment. Per Plaid, if a country code is sent that the account
isn't approved for, the returning-user "Remember Me" phone flow falls
back to standard Link / rejects the number.

**What you do:**
1. Go to **Plaid Dashboard → Team Settings → Country access**
   (<https://dashboard.plaid.com/team/settings>).
2. Confirm **Canada** is enabled for the **Production** environment.
   (Sandbox enables CA by default, which is why CA worked in earlier
   sandbox testing but the real phone screen rejects it.)
3. If Canada is **not** enabled, request access. Plaid sometimes grants
   CA automatically with Production approval, sometimes it needs a
   separate request. Until it's granted, the `['US','CA']` code can't
   take effect for Canadian users.
4. Once Canada shows as enabled, re-test — same +1 dropdown, but Canada
   is now a recognized country for the token, and the bank picker shows
   both US and Canadian institutions.

**Note on where to test:** the entire Plaid integration lives on the
`day3` branch only — it is NOT on `master`, so it is NOT on the
vigilance.revarity.com production deploy yet. Plaid Link can only be
exercised on the `day3` Vercel **preview** URL until `day3` is promoted
to `master`. See the report at the end of this session for the
promotion decision.

**French Canadian (`fr`) support:** intentionally deferred to v1.1.
Language stays `en` for now.

---

## Plaid Recurring Transactions product — needs grant request

**What I'll ship:** scaffolded `/app/subscriptions` route with empty-
state UI + the data shape ready to consume.

**What you do:** in the Plaid Dashboard, request the **Recurring
Transactions** product addition for the production environment. It's
not a default product — needs explicit approval. Once granted, the
existing `LINK_PRODUCTS` list in `lib/plaid.ts` needs to be extended
and users may need to re-link banks to pick up the new product scope.

---

## Multi-user workspaces (Task 3.1) — schema migration is destructive-ish

**What I'll ship:** workspaces + workspace_members tables,
workspace_id added to every user-scoped table, every RLS policy
rewritten to scope by workspace membership instead of user_id, invite
flow.

**Migration safety:**
- Existing data gets auto-migrated to a "Personal" workspace per
  user (so nothing breaks for solo users)
- The schema changes are pushed to Supabase by me as part of the
  build, so when you promote `day3` to production no manual SQL is
  needed
- Rollback path: revert the relevant migrations + redeploy a prior
  Vercel build. Workspaces tables can stay in the DB without code
  using them.

**Heads up:** the invite flow uses Supabase magic links scoped with
workspace_id in the URL. The first invitee to join after promotion
will validate end-to-end — keep an eye on it.
