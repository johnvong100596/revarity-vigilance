# BLOCKERS / flags — v1.1 batch

Items needing Cena's hands or awareness. Updated as the batch progresses.

---

## FLAG: production was NOT actually promoted to day3 (verify before relying)

The batch context said *"master (production) is at 8173156's parent —
Cena promoted day3 → production this morning. After promotion, day3 ==
master."* Git says otherwise:

- `origin/master` HEAD is `80f6803` (2026-05-25, "Housekeeping: /app/settings
  placeholder + THESIS.md aesthetic refs") — exactly where it was three
  nights ago, before any of the night-batch / afternoon / Plaid / WS work
  shipped.
- `day3` is **66 commits ahead of `origin/master`**.
- vigilance.revarity.com (deploys from master) is therefore still the
  pre-Plaid, pre-workspaces, pre-everything app.

**Implication:** no v1.1 work — and none of the previous batches' work —
is actually visible at vigilance.revarity.com yet. All this work lives on
`day3`. When you're ready, review `day3` and promote it to `master`
deliberately (it will ship every batch at once). Until then, test on the
day3 Vercel preview URL.

This is the third consecutive batch where the spec assumed promotion had
happened and it hadn't — flagging clearly so the assumption gets corrected.

---

## Plaid Recurring Transactions still not granted (WS4)

Same as the night-batch BLOCKERS: subscription detection cannot pull real
data until the recurring-transactions feed is enabled with Plaid. The
preview UI ships with sample charges + a "coming soon" note (per night
WS6.3). When the grant lands, replace SAMPLE_SUBS with the real query.
