# Positioning & Pricing — operationalizing SaaS thread #1

**Status:** decision doc. Turns the strategy notes in IDEAS-VIGILANCE-SAAS.md #1
into a concrete free-vs-paid boundary, a pricing recommendation, and a naming
direction — the three things #1 is supposed to decide ("#1 is free and decides
pricing, copy, and roadmap"). Written to pair with the billing scaffolding
shipped this run (commit `ce36258`). **Pricing numbers are a recommendation; the
final call is Cena's** (marked NEEDS CENA).

---

## 1. The one-line positioning

> **The money app that tells you the one thing to do next — in plain English.**
> Free for everyone. A paid tier for people who run businesses.

Every incumbent (Mint, Monarch, Copilot, YNAB) is a dashboard for people who
already enjoy managing money. Vigilance is for the people who don't. The moat is
radical simplicity, not features — so the product's job is to *decide* and *tell*,
not to hand over charts. That principle is the tie-breaker for every
free-vs-paid and copy question below.

---

## 2. The free / paid boundary (the actual product decision)

The billing scaffolding already enforces this with one flag: a paid subscription
flips `profiles.is_operator`, which every "operator" gate already respects. So
the boundary below is literally "what lives behind `is_operator`."

**Free — "what do I do about my money today?" (everyone)**
- The hint home screen — the single most important thing to do next.
- Link banks (Plaid), net worth, accounts, balances, the daily check-in & streak.
- Credit-card use / payment hints, the Ask box, the weekly & monthly emails.
- Personal-scale money. No businesses, one implicit "you."

**Paid — "run your businesses" (the business-owner tier)**
- Multiple businesses (entities) and tagging accounts to them.
- Who-owes-whom tracking (the IOU ledger) and money moved between businesses.
- How-long-your-cash-lasts (runway) and the cross-business hints (e.g. H-307).
- Everything currently gated by `is_operator` today.

This is a clean line: **the free tier is a person; the paid tier is an
operator.** It matches how the code is already split, so no re-architecture — and
it's an honest upsell (you only pay when you actually run businesses).

> NEEDS CENA: confirm this exact boundary. Open question — should *multi-currency*
> (once the Day-6 FX work lands) be a paid feature or free? Recommend free
> (trust/simplicity), but it's a lever.

---

## 3. Pricing recommendation  — NEEDS CENA for final numbers

The free tier is the wedge; it must stay genuinely free and genuinely useful.
The paid tier is priced for a business owner, for whom this replaces spreadsheet
juggling — value far above the price.

| | Recommendation | Why |
|---|---|---|
| Free | $0 forever | The wedge / the "anyone can use it" promise. |
| Business | **$12–15/mo, or ~$120/yr (2 months free)** | Below Monarch ($14.99) for a *simpler* product; annual nudges retention. |
| Trial | **14-day free trial of Business** | Long enough to tag entities + see one runway/IOU cycle. |
| Dunning | Keep access through `past_due` | Already implemented in `lib/entitlements.ts`; a failed card shouldn't instantly nuke access. |

Rationale for a single paid tier (not three): radical simplicity applies to
pricing too. One free, one paid. Per-seat / advisor pricing (SaaS thread #5,
fractional-CFO angle) is a *later* tier, not a launch tier.

> NEEDS CENA: pick the price + trial length. Then create the Stripe product/price
> and set `STRIPE_OPERATOR_PRICE_ID` — the scaffolding does the rest.

---

## 4. Copy & naming direction (Vu test)

The Vu-test audit (AUDIT-AUTONOMOUS-2026-05-29.md, M5) found the heaviest jargon
is in the *names users tap most*. Positioning #1 ("anyone can use it") makes
these blockers, not polish. Recommended renames (NEEDS CENA — brand decision):

- **"Reckoning" → "Weekly review"** (or "Your week"). "Reckoning" is ominous and
  archaic; it's a primary home-screen button.
- **"Monthly Close" / "Lock the month" → "Wrap up the month."** "Close" reads as
  "dismiss"; "close the books" is accounting jargon.
- **"Net worth" → keep the number, add a visible subtitle** "Everything you own,
  minus what you owe." Today that explanation is a hover tooltip (invisible on
  touch — the primary platform) and missing entirely on the weekly/monthly/email
  surfaces.
- **Marketing page**: scrub "CFO-grade," "moat," "6 expert lenses," "waterfall,"
  "credit utilization," "tax residency," "25bps." This page targets a
  sophisticated reader and directly contradicts the positioning.
- **Paid tier name**: market it as **"for business owners,"** never "operator
  tier" (internal word). The billing UI already uses this framing.

I did NOT auto-apply these renames (brand/product call). I *did* fix the
unambiguous developer-jargon leaks this run ("the model," "midnight UTC," "Day 6
cron," "hint engine").

---

## 5. Roadmap implication (how #1 sequences the rest)

#1 → **#2 billing** (scaffolded this run; needs pricing + Stripe keys to go
live) → **#3 trust page + production email** (also the real fix for the
login/deliverability fragility) → **#4 demo/sample mode** (a stranger won't link
a bank before seeing value) → **#5 referral + advisor/per-seat growth**.

The free-vs-paid boundary in §2 is the load-bearing decision: it's what billing
charges for, what the marketing page promises, and what the demo in #4 needs to
show off. Lock §2 and §3-#5 get much easier.
