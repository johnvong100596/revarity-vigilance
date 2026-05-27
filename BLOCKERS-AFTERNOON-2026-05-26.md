# Blockers / flags — afternoon batch 2026-05-26

Items needing Cena's hands, decisions, or awareness from the afternoon
autonomous batch. Code side of each is handled as far as I can take it.

---

## FLAG: "day3 is promoted to production" is NOT true (verify before relying on it)

The afternoon batch context said *"Day3 currently promoted to
production (vigilance.revarity.com)."* Git says otherwise:

- `master` HEAD is `80f6803` ("Housekeeping: /app/settings placeholder
  + THESIS.md aesthetic refs").
- `day3` is **37 commits ahead** of `master`.
- The **entire Plaid integration, workspaces, hints engine, projection,
  Ask Vigilance, emails, crons, and all night-batch + audit work live
  ONLY on `day3`** — none of it is on `master`.
- Vercel production (vigilance.revarity.com) deploys from `master`, so
  production is still the pre-night-batch app.

**Implication:** anything the batch says to "verify at
vigilance.revarity.com" is checking the OLD production app, which won't
have these features. All afternoon work continues on `day3` and is NOT
promoted, per your instruction.

**What you do:** when you're ready, review `day3` and promote it to
`master` deliberately (it ships everything at once). Until then, test
on the `day3` Vercel preview URL.

---

## country_codes reverted to US-only (per your instruction)

You said "don't touch country_codes yet, leave at 'US'." It was actually
at `['US','CA']` (added BUILD 6). I set it back to `['US']` only in
`lib/plaid.ts` so unapproved Canada doesn't ship if `day3` gets promoted
before the Plaid call. Re-add `CountryCode.Ca` after the 2026-05-27
1pm PST Plaid call grants Production country access.

---
