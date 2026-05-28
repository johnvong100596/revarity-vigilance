# Ideas — Operator-Tier Stickiness

**Status:** proposals only — nothing here is built. Pick the ones you want and
I'll spec + build them on a branch.

## The operator we're designing for

Grounded in the real spreadsheet you showed me, not a hypothetical:

- **7 businesses** to keep separate in their head.
- **14+ credit cards / lines** in play at once.
- **~$1.25M in informal debt** — IOUs to and from people, not just banks.
- **Negative cash runway** — this person is in **survival mode**, triaging which
  bill to pay with the cash they have.

The thread through all five ideas: a survival-mode operator opens an app for one
reason — *"what's about to hurt me, and can I cover it?"* Each idea answers a
slice of that, reuses data the app already computes, and gives a reason to open
Vigilance every morning (stickiness).

---

## 1. "What's due next" — a dated 14-day obligation timeline

**What:** One screen listing every obligation in the next 14 days — each card
minimum, each one-off IOU with a due date, each recurring IOU — as a single
date-ordered list with amount and the business it's tagged to, with a running
"can I still cover this?" tally against cash on hand.

**Effort:** S–M. The runway calc (`lib/runway.ts`) already finds and dates every
one of these items to sum them; this surfaces them individually in a new
read-only view instead of collapsing them to one number.

**Why it matters:** With 14 cards and a pile of IOUs, *"what's hitting me this
week and can I cover it"* is the daily question. A flat account list can't answer
it; a dated timeline can. This is the single strongest morning-habit driver.

---

## 2. Per-person net rollup in the IOU ledger

**What:** Group IOUs by counterparty and net the two directions, so a name shows
as one line — "Vu · net you owe $40k (3 open)" — that expands to the individual
IOUs. Surfaces the cases where someone actually owes *you* more than you owe
them.

**Effort:** S. Pure client-side grouping over data `IousClient` already loads.
No schema change, no new server action.

**Why it matters:** $1.25M of informal debt across repeated counterparties is
unreadable as a flat list. Operators think *per person* ("where do Vu and I net
out?"), and netting quietly surfaces found money — receivables hiding behind a
gross total.

---

## 3. "Dry date" on the cash-runway widget

**What:** Alongside "X days of runway", name the actual calendar day cash is
projected to hit zero — "Cash runs dry around June 18" — from a day-by-day
cumulative of the obligations in idea #1.

**Effort:** S. One derived date on top of the runway numbers, reusing the same
obligation walk.

**Why it matters:** "47 days" is abstract; "June 18" is a deadline you plan
against. For survival mode it converts a vague metric into a concrete anchor —
the date you must have money in by.

---

## 4. Stale "owed-to-me" nudge

**What:** A gentle prompt on money-owed-to-you IOUs that have sat open 60–90+
days with no movement — "You logged this on March 1 — still owed?" — with
one-tap "Still open" or "Mark settled".

**Effort:** S. A date check feeding the existing hint surface; reuses the
`settleIou` action already in place.

**Why it matters:** Informal receivables rot — people forget who owes them.
Nudging stale owed-to-me is literally found cash, which is exactly what a
negative-runway operator needs most. Low effort, direct line to real money.

---

## 5. "Minimum to stay current" total + pay-order for cards

**What:** One number — "You must pay $2,140 across 6 cards this cycle to stay
current" — plus, when cash is tight, an ordered *pay-these-first* list (soonest
statement close / biggest credit-score hit first).

**Effort:** M. Minimum payments and due/close days already live on accounts; the
new piece is the ordering logic. Extends the credit page.

**Why it matters:** With 14 cards, the core survival-mode credit question is
*"what's the floor I have to hit, and if I can only pay some, which ones protect
me most?"* This answers both and guards the credit score with limited cash.

---

### How they fit together

Ideas 1 and 3 share one engine (the day-by-day obligation walk) — build 1, get 3
nearly for free. 2 and 4 are small, self-contained wins inside the IOU ledger. 5
is the most standalone and the heaviest. If I had to sequence: **1 → 3 → 2 → 4
→ 5**, front-loading the daily-habit timeline and the netted ledger.
