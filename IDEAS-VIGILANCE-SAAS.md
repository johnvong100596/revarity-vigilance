# Ideas — Vigilance as a Standalone SaaS

**Status:** strategy notes — nothing here is built. This is about turning
Vigilance from a Revarity-internal/branded tool into a sellable, multi-tenant
SaaS. Pick a thread and I'll spec + build it on a branch.

## The wedge: the simplest money app anyone can use

Public and mass-market — built so someone with **zero financial literacy** can
use it *and* a **business owner** can. The moat isn't features, it's **radical
simplicity**. Every incumbent — Mint, Monarch, Copilot, YNAB — is a dashboard
built for people who already enjoy managing money. Vigilance is for the people
who don't: it tells you, in plain English, the **one thing to do next**.

- **Everyone** = free, dead-simple: "what do I do about my money today?"
- **Business owners** = the operator / multi-entity depth as a paid tier on top.
- **Differentiator:** it tells you what to do; it doesn't hand you charts and
  make you figure it out.
- **Tradeoff:** mass-market means more competitors and a higher trust + support
  bar — but simplicity is the one axis every incumbent has abandoned, so it's
  the winnable one.

## Non-negotiable: anyone can use it

If a non-technical 40-year-old — or a stressed business owner with 30 seconds —
can't get value from one screen, it's too complex. Concretely:

- **The hint becomes the home screen.** Open the app, see the single most
  important thing to do right now, in one sentence. The dashboard lives
  *behind* that, not in front of it.
- **One action at a time** — progressive disclosure. Depth exists for those who
  want it, hidden for those who don't.
- **Zero jargon, ever** (the Vu test) — enforce it across onboarding and empty
  states, not just the hints.
- **Accessible by default** — big tap targets, high contrast, large readable
  type; works for older, low-digital-literacy, and ESL users.
- **Frictionless sign-in** — passwordless code entry (the login fix shipping
  now) is exactly this: nothing to remember, no browser hop.

Everything below serves that: simple enough for everyone, with a paid tier for
business owners.

---

## 1. Cut the Revarity umbilical

**What:** Own apex domain + brand, off `*.revarity.com`. Own support address.
Generalize the persona copy that's currently shaped around your real spreadsheet
("Vu", 7 businesses) so it speaks to operators in general.

**Why it matters:** A product living on someone else's corporate subdomain, and
emailing from a `revarity.com` address, reads as an internal tool — and it hurts
both trust and email deliverability with strangers.

**Effort:** S for the domain/brand swap; M to scrub the persona-specific copy.

---

## 2. Billing + plan entitlements

**What:** Stripe subscriptions. The `is_operator` flag / "Path B" becomes a real
paid entitlement instead of a config toggle. Free personal tier, paid operator
tier, trial → paywall on the operator views.

**Why it matters:** No billing, no SaaS. This is the literal conversion from
"tool" to "product with revenue," and it forces the tier boundary to be a real
product decision.

**Effort:** M–L. Stripe + webhook + entitlement gating on the operator routes.

---

## 3. Trust page + production email

**What:** A trust/security page (read-only Plaid, "we never move your money,"
encryption, "we don't sell your data") and a real transactional email provider
(Resend / Postmark).

**Why it matters:** For an unknown product asking for bank credentials, trust is
the #1 conversion blocker — not features. And custom email is a twofer: it's
SaaS table-stakes *and* the real fix for the deliverability fragility behind the
login bug (Supabase's built-in mailer is rate-capped and not meant for
production).

**Effort:** S for the trust page; S–M to wire a real SMTP provider + sender
domain.

---

## 4. A 60-second "aha" for strangers

**What:** A demo / sample mode — a seeded operator workspace so a prospect sees
the runway + obligation timeline *before* linking a real bank. Plus a
manual-entry fallback and broader bank coverage (the Plaid Canada unblock
matters far more for a public SaaS than for internal use).

**Why it matters:** Today all the value is locked behind connecting a real bank.
A stranger won't hand over bank access to a product whose value they haven't
seen yet.

**Effort:** M. A seed fixture + a "try the demo" toggle that loads it read-only.

---

## 5. Distribution loops (you already have the primitives)

**What:** (a) Turn the existing referral system (`referral_token`,
`invited_by_user_id`) into an incentivized loop. (b) B2B wedge: sell the
multi-entity view to fractional CFOs / bookkeepers who juggle several client
entities — per-seat revenue, and they drag their clients in with them.

**Why it matters:** The referral plumbing already exists; the CFO/bookkeeper
angle is a force multiplier and a natural fit for the "manage 7 entities at
once" muscle the app already has.

**Effort:** S to incentivize referrals; M for a multi-client "advisor" view.

---

### What I'd sequence

**1 (positioning) → 2 (billing) → 3 (trust + email) → 4 (demo) → 5 (growth).**

#1 is free and decides pricing, copy, and roadmap. #2 is what actually makes it
a SaaS. #3 unblocks stranger sign-ups (and fixes today's email problem). Only
after those does spend on demo mode and growth loops pay off.
