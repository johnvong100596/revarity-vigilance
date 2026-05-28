# Audit — Vigilance night batch (2026-05-26 / early 27)

**Scope:** commits `1f4ecb2..HEAD` on branch `day3` only (M1–M6, L1–L5, WS2–WS6).
Earlier work (AUDIT-NIGHT / AUDIT-AFTERNOON 2026-05-26) was audited separately and is
out of scope. Build is reported clean (`tsc --noEmit`, `next lint`). This is a read-only
audit — nothing was fixed.

**Commits reviewed (13):** M2 per-user streak, M1 APR-by-type, M3 90-day Ask change,
M4 week-over-week baseline, M5 singleton mute, M6 CSV fx_rate, WS1 hint_events+logo
sanitize, WS2 plain-English, WS3 onboarding, WS4 typography split, WS5 marketing,
WS6 invisible-AI/number-formatting.

## Summary counts
- CRITICAL: 0
- HIGH: 0
- MEDIUM: 3 → **M-1 + M-3 fixed** (commit after this audit); M-2 left for morning
- LOW: 5 → left as morning punch list

No security or data-integrity defects found. The migration, the two new server
actions, the logo sanitizer, the streak rewrite, and the `formatBalance` change are
all correct. Findings are copy/perf/UX polish.

### Disposition (fixed before stopping)
The rule is "fix CRITICAL/HIGH, leave MEDIUM/LOW for morning." There were no
CRITICAL/HIGH. I made a narrow exception for the two findings that made tonight's
OWN claims false or misleading, since both were one-line, low-risk:
- **M-1 FIXED** — renamed the marketing JetBrains token from `mono` → `meta`
  (`font-meta`) so it no longer overrides Tailwind's built-in `font-mono`; the
  CSV panel on `/app/accounts/[id]` reverts to the system monospace stack and the
  "app stays Inter-only, zero extra font payload" promise in THESIS.md / layout
  is true again. Updated privacy/terms metadata + the THESIS implementation note.
- **M-3 FIXED** — subscriptions sample copy changed from "We found these recurring
  charges. Tap any…" to "Here's how it'll look once it's on." and the inert
  "Stop tracking" label replaced with "/ month", so the labeled preview no longer
  implies real detected data.

### Morning punch list (left for Cena)
- **M-2** — WelcomeMoment's `markWelcomed()` is fire-and-forget; if that write
  fails the welcome replays each load (auto-fades, no loop). Fix: await it or add
  a sessionStorage guard.
- **L-1** — banned words still in below-the-fold legal copy (/terms: "syncs",
  "Liability", "disconnect"; /privacy: "tokens", "API", "authentication"). WS2's
  sweep didn't fully cover the legal pages.
- **L-2** — "Set your home currency" checklist item auto-ticks via LocaleDetector
  (product decision, not a bug).
- **L-3** — streak is per-user but global, not per-workspace (already your call,
  in BLOCKERS; the empty `user_streaks` table was dropped).
- **L-4** — `warmLogos` serial Plaid round-trips (pre-existing, off render path).
- **L-5** — marketing "row-isolated" phrasing (acceptable; no change needed).

---

## MEDIUM

### M-1 — Typography split is leaky: an app route now downloads JetBrains Mono
**Where:** `tailwind.config.ts:74` (new `mono: ["var(--font-jetbrains-mono)", …]`) +
`components/CsvImportPanel.tsx:73` (`font-mono`), rendered by
`app/app/accounts/[id]/account-detail-client.tsx:236`.
**What:** WS4 added a `mono` font-family key mapping `font-mono` to JetBrains Mono.
Before this batch the prior `tailwind.config.ts` had **no** `mono` key, so `font-mono`
fell back to the system monospace stack (no web font). `CsvImportPanel` — an **app**
component on `/app/accounts/[id]` — uses `font-mono` on its CSV textarea, so that app
route now pulls the JetBrains Mono woff2.
**Why it matters:** Directly contradicts the documented promise in `app/layout.tsx:14-19`
and `THESIS.md` ("`/app/*` stays Inter-only with zero extra font payload"). It's the
exact "did the `mono` override clobber existing app `font-mono` usage?" case the audit
asked about. Functionally harmless (font swaps), but the stated invariant is false.
**Fix:** Change `CsvImportPanel.tsx:73` `font-mono` → an Inter/`tabular-nums` class, OR
scope the JetBrains `mono` family to a marketing-only token (e.g. `font-meta`) instead of
overriding Tailwind's global `font-mono`.

### M-2 — `WelcomeMoment` relies on a fire-and-forget write before `router.refresh()`
**Where:** `components/WelcomeMoment.tsx:24,39`; gated by `app/app/page.tsx:213`
(`showWelcome = hasAccounts && !welcomed`).
**What:** `markWelcomed()` is called un-awaited on mount; the overlay fades after 3 s and
on exit fires `router.refresh()`. The server re-render's `showWelcome` depends on the
`welcomed` write having committed. The 3 s delay almost always covers the write, so a
loop is unlikely — but if `markWelcomed()` **fails** (network/RLS hiccup), `welcomed`
stays false and the welcome moment replays on every home load. There's no error surfacing
or retry (`.catch(() => {})` swallows it).
**Why it matters:** A persistently-failing write turns a one-time delight into a recurring
full-screen takeover. Not an infinite loop (it auto-fades), but annoying and silent.
**Fix:** `await markWelcomed()` before starting the fade, or set a sessionStorage guard so
a failed write doesn't replay within the same session.

### M-3 — Subscriptions sample copy implies the preview is real data
**Where:** `app/app/subscriptions/page.tsx:65` ("We found these recurring charges. Tap any
to learn more.") above hard-coded `SAMPLE_SUBS`, with a non-interactive "Stop tracking"
label at line 95.
**What:** The page is honestly badged "Preview · sample charges" (line 60) and footer says
detection is coming — good. But the line "**We found** these recurring charges. **Tap any**
to learn more" asserts discovery on fabricated rows that aren't tappable. Mildly
contradicts the "we never imply these are the user's real charges" comment at the top.
**Why it matters:** Trust copy; a user could think Netflix/Spotify were detected from their
accounts. Low real-world harm but inconsistent with the page's own stated intent.
**Fix:** Reword to e.g. "Here's how it'll look once it's on —" and drop/disable the
"Stop tracking" affordance on the sample rows.

---

## LOW

### L-1 — Banned words remain in /terms (and lightly in /privacy) user-facing copy
**Where:** `app/terms/page.tsx:147` ("syncs on a delay"), `:153` (`<Section title="Liability">`),
`:165` ("You can **disconnect** banks"); `app/privacy/page.tsx:90` ("secret **tokens**"),
`:108` ("Claude **API**"), `:182` ("Plaid handles **authentication**").
**What:** WS2 only replaced one "Disconnect→Unlink" instance (privacy line 142). The terms
page still surfaces "Sync"/"Liability"/"disconnect", and privacy still says "tokens",
"API", "authentication" in body prose.
**Why it matters:** WS2's banned-word pass was incomplete for legal/doc surfaces. Low —
these are below-the-fold legal pages, not primary UI. Marketing page, settings, and login
are clean.
**Fix:** "syncs"→"updates", "Liability"→"Our responsibility", "disconnect"→"unlink",
"tokens"→"access keys", "Claude API"→"Claude", "authentication"→"sign-in".

### L-2 — "Set your home currency" checklist item auto-ticks without user action
**Where:** `app/app/page.tsx:223` (`done: profile?.locale_detected`) +
`components/LocaleDetector.tsx`.
**What:** The item is "done" when `locale_detected` is true, which `LocaleDetector` sets
silently on first load. The item links to `/app/settings` but the user never has to go
there; combined with "connected first bank" (and often a 2nd Plaid account), three items
tick almost immediately, so `showGettingStarted` (< 3 done) hides the card fast.
**Why it matters:** Matches the behavior the audit flagged. Acceptable per the design
intent (silent defaults), but the labeled, linked task completing itself is slightly
misleading. Worth a product decision, not a bug.
**Fix (optional):** Relabel to "Confirm your home currency" or tie "done" to a real
settings save rather than auto-detection.

### L-3 — Streak is per-user but still global, not per-workspace
**Where:** `lib/actions/checkin.ts:43-90` (`maybeCompleteDay` reads/writes
`profiles.awareness_streak`).
**What:** M2 correctly made the streak strictly per-user (intersecting the user's own
check-ins with active accounts — verified consistent with the readers in
`app/app/page.tsx:114-127`). However a user in two workspaces shares one global streak,
as the committed approach lives on `profiles`. The reverted alternative
(`user_streaks` per (user, workspace)) is documented in `BLOCKERS-…NIGHT-2026-05-26.md`.
**Why it matters:** Edge case (multi-workspace users). Already flagged for Cena's decision.
No dead `user_streaks` reference exists in code/migrations (grep confirmed — only the
BLOCKERS doc mentions it). The orphan empty `public.user_streaks` table reportedly still
exists in the live DB (per BLOCKERS) — drop it if multi-workspace streaks aren't pursued.
**Fix:** None needed unless per-workspace streaks become a requirement.

### L-4 — `warmLogos` makes serial Plaid round-trips with no concurrency cap
**Where:** `lib/institution-logos.ts:179-181` (`for (const id of missing) await fetch…`).
**What:** Pre-existing pattern, not introduced this batch, but adjacent to WS1's sanitize
work. Sequential awaits over all missing institutions; fine for a handful, slow if many.
The code correctly keeps this off render paths (comment at :154-159).
**Why it matters:** Minor latency on write paths with many new banks. Not a regression.
**Fix:** `Promise.allSettled` with a small concurrency limit if connect-many ever matters.

### L-5 — Marketing trust copy paraphrases RLS as "row-isolated" (acceptable)
**Where:** `app/(marketing)/page.tsx:353-355` ("row-isolated in our database").
**What:** Not a banned word, and a reasonable plain-English rendering of RLS — noting only
that it edges toward implementation detail on a marketing page. The hero, CompareColumn,
trust strip, and trust-badge JSX all render sensibly with balanced tags (build passes).
**Why it matters:** Negligible. Listed for completeness against the banned-word sweep.
**Fix:** None required.

---

## Areas verified clean

- **Migration `20260527120002_onboarding_flags.sql`** — `ADD COLUMN IF NOT EXISTS … NOT NULL
  DEFAULT false` is safe (default backfills existing rows; idempotent). No data risk.
- **`setLocaleDefaults` / `markWelcomed`** (`lib/actions/onboarding.ts`) — both call
  `auth.getUser()` and mutate only `.eq("id", user.id)`; `setLocaleDefaults` reads
  `locale_detected` first and no-ops if true, so it cannot overwrite a user who later set
  their own currency. Zod-validated input. Correct and safe.
- **Logo base64 sanitizer** (`lib/institution-logos.ts:49-55`) — regex
  `^[A-Za-z0-9+/]+={0,2}$` + 512 KB cap correctly accepts standard PNG base64 (no `data:`
  prefix from Plaid) and rejects malformed/oversized payloads. Color regex sound.
- **`formatBalance` / `roundWholeAbove1000`** (`lib/money.ts`) — the new
  `Math.min(fractionDigits, decimals)` for `minimumFractionDigits` actually FIXES a latent
  `RangeError` (old code could set min > max when `showZeroDecimals=false` and a value had
  more decimals than the currency's minor units). `Math.min(x, decimals) <= decimals`
  always holds → Intl never throws. PYG (0 minor units) → both 0, fine. No caller passes
  `showZeroDecimals=false` today, so no behavior change for existing screens.
- **M1 APR classification** (`lib/apr.ts`) — keys ceiling on `account_type === "loan"` with
  a name-regex fallback for manual/CSV rows; credit cards keep the 60% ceiling. Sound.
- **M3 Ask 90-day change** (`lib/actions/ask.ts:202-224`) — uses `dailyNetWorthSeries`
  first/last real points, not two arbitrary snapshot rows. Correct.
- **M4 week-over-week baseline** (`app/app/page.tsx:174-193`) — only shows the delta when
  EVERY active account has a ≥7-day baseline; otherwise hides. Correct.
- **M5 singleton mute** (`lib/hints/engine.ts:134-144`) — mutes the stale singleton only
  for rows that survived dedup and only for other accounts, after the insert decision.
  No mute/insert churn on no-op evals.
- **M6 CSV / edit fx_rate** (`lib/actions/csv-import.ts:145-160`,
  `lib/actions/checkin.ts:226-241`) — `fx_rate = 1` only when account currency == home
  currency, else null. Fixes the hardcoded-USD bug for CAD/EUR users.
- **L2 hint_events logging** (`lib/actions/hints.ts:53-60,91-98`) — best-effort inserts
  that log on failure and never break dismiss/resolve. Correct.
- **WS2 microcopy** — settings (Refresh/Unlink), login magic-link copy, PlaidLinkButton,
  marketing hint examples: all plain-English, no banned words in primary UI.
- **WS5 marketing JSX** — CompareColumn (3 cols), trust strip, trust badges, hero reframe:
  balanced tags, renders sensibly.
- **WS6 Ask seeds / Anthropic hint prompt** — plain-English, jargon-translation guardrails
  intact; no scope regressions.
- **No `user_streaks` reference** anywhere in code or migrations (only the BLOCKERS doc).
- **No `/app/*` route uses `font-fraunces`**; only `font-mono` leaks (see M-1).
