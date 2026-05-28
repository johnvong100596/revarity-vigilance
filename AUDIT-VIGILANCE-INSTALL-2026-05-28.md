# Session Wrap — Install CTA + Morning Punch List + Audits

**Date:** 2026-05-28
**Branch:** `install-cta` — **7 commits ahead of master, 0 behind. Nothing
pushed. Master untouched.** Yours to review and merge from your phone.

---

## What shipped (in commit order)

| Commit | What |
|--------|------|
| `65c35b8` | **Task 1 — Install-on-phone CTA.** Hero secondary trigger, footer install band, device-detected install modal (iOS Safari / Android Chrome / Desktop Chromium / Firefox+Safari fallback), and a dismissible smart banner (10s, sessionStorage-gated). Vigilance cream/red, Inter. |
| `2d681c2` | **M-1.** Personal-entity seed made race-safe — a double-tapped operator toggle no longer throws; the unique-constraint loser (23505) is swallowed as the race resolving correctly. |
| `da6265e` | **M-2.** Retagging a shared account as a non-owner/admin no longer silently no-ops — the RLS-filtered 0-row update now surfaces a plain-English error and the dropdown reverts. |
| `6a6a600` | **M-3.** Cash runway now counts cash-like investment accounts (HISA / money-market / high-interest savings) via an `isLiquidCash()` helper, while keeping plain brokerage balances out so runway is never overstated. |
| `609ebd5` | **M-4.** Recurring-occurrence check rejects an invalid day-of-month (0, NaN, >31) instead of letting `new Date(y, m, 0)` roll back to the prior month's last day. |
| `37b91de` | **Task 3 — Plain-English audit round 3.** Two operator-tier copy fixes in the runway widget + a findings doc. |
| `2fc5ef6` | **Task 4 — 5 operator-tier stickiness ideas** (proposals only, not built). |

Companion docs on the branch: `AUDIT-PLAIN-ENGLISH-R3-2026-05-28.md`,
`IDEAS-VIGILANCE.md`.

---

## Verification

- `npx tsc --noEmit` — clean.
- `npx next lint` — "No ESLint warnings or errors".
- `npx next build` — full route table, no errors (run after Task 2 and again at
  the end).
- Task 1 was verified interactively in-browser earlier in the session (platform
  detection, modal open/close, banner timing) via the Preview tool.

**Not verified by me:** the install modal on *real* iOS/Android hardware. The
UA-based platform detection and the copy are best-effort; worth a 60-second
sanity check on your actual phone before merge, since that's the whole point of
the feature.

---

## Decisions waiting on you

1. **Runway headline wording** (`components/CashRunway.tsx`). I left "X days of
   runway" / "Sustainable" because they're your product's voice and the subtitle
   already explains them plainly. If you want them fully jargon-free: "X days of
   cash left" / "You're ahead this month". 2-line change — say the word.
2. **Round 4 — hard-coded hint copy.** Out of scope this round, but found while
   sweeping: `lib/hints/H-002` still titled "Credit utilization danger"
   (the word your AI prompts explicitly ban), and `lib/hints/H-201` is dense with
   "risk assets / 60-40 benchmark / drawdown / over-reserving". Recommend a
   dedicated plain-English pass over `lib/hints/`. Details in the R3 doc.

---

## Housekeeping

- Removed a cross-repo `.claude/launch.json` I'd created in the unrelated
  `lease-tool` repo (Preview-tool scaffolding) — that repo is clean again.
- Left `vigilance/.claude/launch.json` in place (untracked, the correct home for
  the Preview config). It won't appear in your PR diff. If the `?? .claude/` in
  `git status` annoys you, add `.claude/` to `.gitignore` — I didn't, to avoid
  an unrequested source change on the branch.
- Two local dev servers from this session may still be running (ports ~3008 and
  ~3009). Harmless; close them whenever.

---

## Bottom line

Everything is on `install-cta`, green, and committed in clean per-task slices.
Master was never touched and nothing was pushed. Review and merge at your pace.
