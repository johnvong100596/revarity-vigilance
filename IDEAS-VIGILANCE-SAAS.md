# Ideas — Vigilance as a Standalone SaaS

**Status:** strategy notes — nothing here is built. This is about turning
Vigilance from a Revarity-internal/branded tool into a sellable, multi-tenant
SaaS. Pick a thread and I'll spec + build it on a branch.

## The wedge (the one decision everything hangs on)

Don't ship a standalone *personal-finance* app — that's a head-on fight with
Monarch, Copilot, and YNAB, and you'd be an unknown brand asking strangers to
connect a bank. The underserved niche is the operator you already built for:
someone running **multiple messy entities**, a wall of cards, **informal IOUs**,
triaging cash daily. Make *that* the product.

- **Personal tier** = the free funnel.
- **Operator tier** = the paid SaaS.
- **Tradeoff:** smaller market than mass-market personal finance, but
  defensible, higher willingness-to-pay, and the hard parts (multi-entity, IOU
  ledger, runway) are already built.

Everything below assumes that wedge.

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
