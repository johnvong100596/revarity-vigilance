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

## DECISION NEEDED: WS4 asked for Fraunces + JetBrains Mono — conflicts with locked THESIS spec

Workstream 4 (document family) specified: *"Fraunces for headings, Inter
for body, JetBrains Mono for legal labels."*

But THESIS.md (the stated source of truth, **locked 2026-05-25**) says:
> "Inter throughout, no serif. Heavy weights for hero typography."

The whole app is wired Inter-only — `tailwind.config.ts` even maps the
`serif` and `display` tokens to Inter. Recent commits ("Inter-only
typography", "v2 cream/black/red tokens") reinforce this.

**What I did instead of unilaterally re-fonting:** since introducing
Fraunces/JetBrains contradicts a locked spec (high blast radius, hard to
undo), I did the WS4 work that is font-*independent* and left the
typeface as the locked Inter:
- 4.1: verified /privacy + /terms already match the cream/red + Inter
  aesthetic with consistent structure (no rebuild needed). Fixed a
  factual inaccuracy on /privacy ("your own Supabase project" →
  "row-isolated in our database").
- 4.2: made all footers consistent (marketing, settings, privacy, terms)
  — each links Privacy, Terms, coo@revarity.com, and "Built by Revarity
  LLC" → revarity.com.
- 4.3: confirmed all 4 email templates already share the cream/red
  palette + identical Inter/system font stack. Did NOT add the requested
  Georgia/serif fallback (same conflict).

**What you decide:** do you want to override the locked THESIS spec and
move the document family (and/or the whole app) to Fraunces headings +
JetBrains Mono labels? If yes, I'll add the fonts and a v3 typography
section to THESIS.md and roll it through. If the Inter-only lock stands,
no further action — WS4 is complete as shipped.

---

## country_codes reverted to US-only (per your instruction)

You said "don't touch country_codes yet, leave at 'US'." It was actually
at `['US','CA']` (added BUILD 6). I set it back to `['US']` only in
`lib/plaid.ts` so unapproved Canada doesn't ship if `day3` gets promoted
before the Plaid call. Re-add `CountryCode.Ca` after the 2026-05-27
1pm PST Plaid call grants Production country access.

---
