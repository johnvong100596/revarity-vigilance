# Plain-English Audit — Round 3 (Operator Tier)

**Date:** 2026-05-28
**Branch:** install-cta
**Scope:** Every user-facing string on the operator-tier surfaces — the "I run
businesses" toggle, business manager, account tagging/filtering, the IOU ledger,
money-between-businesses flows, and the cash-runway widget.
**Test bar:** the Vu test — a non-technical 70-year-old reads it and gets it. No
finance/startup jargon.

---

## TL;DR (honest)

The operator tier is **already in very good shape**. Rounds 1–2 clearly did the
heavy lifting: the big swaps this round was meant to catch were already done.

- "Entity / Entities" → **already** "business / businesses" everywhere a user
  can see it. ("Entity" survives only in code: type names, table names,
  comments — not user-facing.)
- "Utilization" → **already** "Credit use" on the credit page ("Using 47% of
  your credit", "Owing now", "Still available"). No "utilization" anywhere in
  operator-tier UI.
- "Liability / Asset" → **never surfaced** to users in the operator tier. These
  words live only in code (the `asset | debt` enum, Plaid product names).

So Round 3 is a light touch: **2 real fixes**, a couple of items **flagged for
your call**, and a bigger jargon pocket found **outside** this tier (hints) that
deserves its own round.

---

## Fixes made (committed this round)

Both in `components/CashRunway.tsx` (operator-only widget on the home screen):

1. **"Net this month" → "Left over this month" / "Short this month."**
   "Net" is bank-app shorthand a layperson may not parse. The label now flips
   with the sign: a surplus reads "Left over this month +$1,200"; a shortfall
   reads "Short this month −$800". Same number, plain words.

2. **Runway footnote rewritten.** Was: *"Estimated from cash + active IOUs +
   credit-card minimums. A real spend-rate signal lands when our bank-data
   partner turns on the recurring-charge feed."* That's three pieces of jargon
   ("spend-rate signal", "bank-data partner", "recurring-charge feed"). Now:
   *"A rough estimate from your cash, your IOUs, and credit-card minimum
   payments. It'll get sharper once your bank starts sharing your regular
   monthly charges."*

---

## Flagged for your call (not changed)

These are **brand/identity words**, not accidents — so I left them and am
surfacing the choice to you rather than overwriting your voice while you're away.

- **"runway" / "Sustainable"** (CashRunway headline). "X days of runway" and the
  one-word "Sustainable" are mild finance/startup terms. The subtitle already
  explains both in plain English ("On day 30 you'll have around $X at this
  pace." / "More coming in than going out this month."), so they're cushioned.
  If you want them fully Vu-proof: "X days of cash left" and "You're ahead this
  month". Say the word and I'll swap them — it's a 2-line change.

## Considered and deliberately kept

- **"Untagged" filter chip** (EntityFilter). Kept — the whole tier uses a
  consistent "tag your accounts by business" metaphor ("Tag to a business",
  "tagging accounts by business"). Changing only the chip to "Not assigned"
  would break that consistency. The metaphor itself is plain enough.
- **"IOU / IOUs"** — kept. It's everyday vernacular ("write me an IOU"), far
  plainer than "liability/receivable", and the tabs already spell out the
  meaning ("I owe", "Owed to me").
- **"Mark settled / Settled"** — kept. "Settle a debt" is common speech.

---

## Out of scope — recommend a Round 4 (core hint copy)

While sweeping, I found the **hint engine** copy (core tier, not operator) still
carries real jargon. This is a separate body of work — some of it needs
rewriting, not word-swaps — so I did **not** touch it this round. Flagging for a
dedicated pass:

- `lib/hints/H-002-credit-utilization.ts` — title **"Credit utilization
  danger"**. This is the exact word the credit page already replaced with
  "Credit use", and the app's own AI rules ban it (`lib/anthropic.ts`,
  `lib/actions/ask.ts` both list "utilization" as forbidden). One-word fix.
- `lib/hints/H-201-portfolio-weighting.ts` — body is dense: "risk assets",
  "portfolio", "the classic 60/40 stock/bond benchmark", "concentrated", "a
  single drawdown", "over-reserving", "drag on long-run returns". Needs a real
  rewrite, not a swap.
- Worth grepping the rest of `lib/hints/` in that round for the same offenders.

The irony worth noting: the app *forbids* this jargon for its AI-generated copy
but a few *hard-coded* hint strings predate that rule and slipped through.

---

## Surfaces verified clean (for the record)

`components/OperatorSection.tsx` ("I run businesses", "Your businesses",
"Business name") · `components/EntityAssign.tsx` ("Assigned to", "Not assigned")
· `components/EntityFilter.tsx` · `components/IousClient.tsx` (tabs "I owe" /
"Owed to me" / "Between mine"; "Money you owe to people outside the app." etc.)
· `app/app/ious/page.tsx` ("Money in & out") · `app/app/credit/page.tsx`
("Credit use") · home-screen operator link ("Money in & out — IOUs and transfers
between your businesses").
