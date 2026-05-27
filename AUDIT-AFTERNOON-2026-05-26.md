# Vigilance — Afternoon Batch Audit (2026-05-26)

Scope: the ~14 afternoon commits on `day3` (WS1 bank icons, WS2 punch list, WS3 engagement, WS4 documents, country_codes revert: `e041bf7..dc11c96`). The night batch (`AUDIT-NIGHT-2026-05-26.md`) was audited separately and is excluded.

## Summary counts

- CRITICAL: 0
- HIGH: 3 → **all 3 FIXED** (commit follows this audit)
- MEDIUM: 6 → left as morning punch list
- LOW: 5 → left as morning punch list

## Disposition (what I fixed before stopping)

Per the batch rule "fix CRITICAL + HIGH yourself, leave MEDIUM/LOW as
morning punch list", all three HIGH are fixed:

- **H1 FIXED** — render no longer calls Plaid. Home / account-detail /
  settings pages now use `getCachedLogosMap` (pure cache read). Logo
  warming moved to write paths: `warmLogos()` runs in the exchange route
  (on connect) and the sync route (manual "Sync now" backfills logos for
  pre-feature connections). `ensureLogos` renamed → `warmLogos`, explicitly
  documented as write-path only.
- **H2 FIXED** — logo fetch now uses a dedicated `LOGO_COUNTRY_CODES`
  `[US, CA]` (metadata-only, doesn't touch the Link phone flow), and
  empty/failed rows use a 2-day retry TTL instead of 30 days, so a CA
  bank (or a transient failure) retries on the next sync rather than
  showing a letter for a month.
- **H3 FIXED** — `StreakBadge` takes `todayLocal` and builds its grid with
  `addDaysISO` from the user's local today; the home page computes `today`
  + `accountsNeedingCheckin` via `localDateISO(tz)`; the check-in page's
  UTC `todayISO()` replaced with `localDateISO(tz)`. L5 (the
  `accountsNeedingCheckin` UTC compare) was folded into this fix too.

### MORNING PUNCH LIST (MEDIUM/LOW — not fixed, for Cena)

Top of the list, because it affects a shipped feature:
- **M2** — in a multi-member workspace the streak can never complete
  (`maybeCompleteDay` counts accounts workspace-wide but check-ins
  per-user). Single-user workspaces unaffected. Needs an ownership/
  assignment decision before fixing.
- **M6** — CSV import still hardcodes USD fx_rate (the one M5 call site
  missed). One-line fix, deferred only to honor the fix-scope rule.
- M1 (APR text-heuristic classification), M3 (ask.ts 90-day change uses
  raw rows not net-worth totals), M4 (week-change baseline blends
  new accounts), M5 (singleton-hint mute churn on ranking flips).
- L1 (double cache query in warmLogos), L2 (hint_events insert error
  unlogged), L3 (base64 img hardening — not a vuln), L4 (tz picker offers
  regions the product is US-only on).

---

## CRITICAL

None. The base64-into-`<img src>` data URI is not an injection vector (see H1 for the realistic risk that does exist), RLS on all three new tables is correctly default-deny + owner-scoped, the SECURITY DEFINER RPC changes are a faithful superset of the originals, and migrations are idempotent.

---

## HIGH

### H1 — Home page server render makes synchronous Plaid calls on cache miss/stale (unbounded tail latency)
- `app/app/page.tsx:134` (`await ensureLogos(...)`), `lib/institution-logos.ts:149-151`
- `ensureLogos` fetches missing/stale institutions **sequentially in a `for` loop**, each a blocking `plaid().institutionsGetById` round-trip, during the server render of the home page. With N connected institutions all cold (or all stale on the same day after the 30-day TTL lapses), the home page blocks on N serial Plaid calls before first byte.
- Why it matters: TTL expiry is correlated (all logos fetched at connect time expire together ~30 days later), so a single page load can pay the full serial cost; a slow/timing-out Plaid adds seconds. Also re-runs the admin `SELECT fetched_at` + Plaid on every load until the upsert lands.
- Fix direction: move logo warming off the render path (warm only in exchange/webhook + a cron), or in `ensureLogos` fetch missing ones with `Promise.allSettled` and a per-call timeout; render should only ever read the cache (`getCachedLogosMap`).

### H2 — Plaid logo fetch uses US-only country codes; CA/other institutions silently cache empty + never retry until TTL
- `lib/institution-logos.ts:66` (`country_codes: LINK_COUNTRY_CODES`), `lib/plaid.ts:132` (`LINK_COUNTRY_CODES = [CountryCode.Us]`)
- `institutionsGetById` requires country codes that cover the institution's country. A non-US `institution_id` will 400/empty, the catch block then upserts an empty row (`logo=null`) and won't retry for 30 days (`isStale`).
- Why it matters: when Plaid CA access lands (the revert commit `e041bf7` says it's a dashboard blocker, not code), every CA bank icon will be a permanent letter-fallback until manual cache purge. It also burns a Plaid call + write per cold non-US institution.
- Fix direction: pass the institution's own country (store it on `plaid_items`/`accounts`) or send the full supported set; on a failed fetch, store a short retry TTL rather than the full 30 days.

### H3 — StreakBadge calendar grid uses UTC dates while check-ins are stored in user-local dates (off-by-one cells)
- `components/StreakBadge.tsx:28-30` (`new Date(...).toISOString().slice(0,10)`), vs `app/app/page.tsx:112` (checkin_date filter) and `lib/actions/checkin.ts:51,97` (writes `localDateISO(tz)`).
- The new tz work (H5) makes `check_ins.checkin_date` the user's *local* calendar date, but the badge grid builds its 35 cells from UTC (`toISOString`). For a user west of UTC in the evening, "today" in the grid can be tomorrow's UTC date, so the freshly-completed day renders as an empty cell (and the real day is shifted).
- Why it matters: the streak calendar — a core WS3 engagement surface — will visibly mismatch the streak count for any non-UTC user near the day boundary. Same UTC assumption in `app/app/page.tsx:178` (`today` for `accountsNeedingCheckin`) and `checkin/page.tsx:9-10` (`todayISO`).
- Fix direction: pass the user's tz to the badge and build cells with `localDateISO(tz, d)`; replace the UTC `todayISO()` in the check-in page and the home page's `accountsNeedingCheckin` with `localDateISO(tz)`.

---

## MEDIUM

### M1 — APR amortizing classification is heuristic text-matching; mis-tiers loans → over-clamps valid APRs
- `lib/apr.ts:19-22`, used by `lib/hints/H-001-debt-priority.ts:22` and `account-detail-client.tsx:443`
- `looksAmortizing` only matches `mortgage|student|auto|car loan|home loan|heloc` in name/subtitle. A "Personal Loan", "RV loan", or a mortgage named "My House" gets the 60% credit ceiling (harmless), but more importantly Plaid mortgage/student accounts ingested via Liabilities set APR by *product*, not name — `lib/plaid.ts:246-247,267-268` warns with hardcoded `"mortgage"`/`"student"` kinds (correct), but the UI/hint re-derive the kind from text and can disagree with ingest.
- Why it matters: an amortizing loan whose name doesn't match the regex but has a legit ~7% APR is fine; the real risk is a genuinely high-but-valid credit APR (e.g., a 29.99% card) is correctly verified, but a 26% retail-card APR on an account mis-detected as "auto" (e.g., "CarMax Card") would be flagged unverified and dropped from H-001.
- Fix direction: classify by `account.account_type`/Plaid subtype, not free-text name matching; reserve text as a fallback.

### M2 — `maybeCompleteDay` counts active accounts workspace-wide but check-ins per-user → multi-member workspaces can't complete a day
- `lib/actions/checkin.ts:53-68`
- `activeAccountsCount` is RLS-scoped to the *workspace* (all members' accounts), while `checkedInCount` filters `.eq("user_id", userId)`. In a shared workspace with accounts a given user didn't personally check in, `checkedInCount < activeAccountsCount` is always true, so the streak never increments for that user.
- Why it matters: workspaces are a shipped feature; any multi-account shared workspace silently breaks the streak/celebration that WS3 is built around. (Single-user workspaces are unaffected.)
- Fix direction: count active accounts the user is expected to check in (define ownership/assignment), or count distinct accounts with any check-in for `today` regardless of who, consistently with the active-accounts scope.

### M3 — `ask.ts` 90-day change compares raw per-row snapshot balances, not net worth totals
- `lib/actions/ask.ts:200-206`
- `ninetyDayChange = last.balance - first.balance` uses two arbitrary individual snapshot rows (ordered by `captured_at`), not the net-worth aggregate. `first`/`last` may be different accounts entirely, so the "90-day change" fed to Claude is meaningless.
- Why it matters: the LLM quotes this number to the user as their 90-day net-worth trend (`buildContextBlock:61-63`). Pre-existing pattern, but the afternoon recount work (L3) touched this file without fixing it; worth flagging.
- Fix direction: aggregate snapshots into per-day net-worth totals (as the home page / rituals do) before taking first vs last.

### M4 — Week-over-week baseline falls back to *current* balance per missing account, understating change
- `app/app/page.tsx:166-176`
- For accounts with no snapshot on/before 7 days ago, the baseline uses the **current** balance (`?? Number(a.balance)`), so a brand-new account contributes 0 to `weekChange`. `haveWeekBaseline` flips true if *any* account has an old snapshot, so the figure is shown even when most accounts lack a baseline.
- Why it matters: the "+$X this week" headline can be materially wrong (e.g., a large new account connected mid-week shows as $0 change). Mixed-baseline is silently blended.
- Fix direction: only show week change when all (or a clearly-communicated subset of) accounts have a ≥7-day-old snapshot; or attribute new-account balances explicitly.

### M5 — Singleton hint mute runs on every engine call and can mute a still-valid hint when an evaluator transiently fires for a different account
- `lib/hints/engine.ts:94-106`
- The L2 block updates `status='muted'` for any active H-001 hint whose `related_account_id != newAccountId` whenever the evaluator fires — before dedup/insert. If the "worst debt" flips back and forth (two debts with near-equal APRs across syncs), the engine churns mute/insert each run. It also mutes even if the new firing is itself a dedup no-op (the mute happens in a separate loop from the dedup check at :127).
- Why it matters: legitimate active hints get muted on transient ranking flips; runs on every balance-changing write (sync/exchange/edit), so churn is frequent. Muted (not dismissed) so it won't resurface to the user — silent loss.
- Fix direction: only mute when the new hint will actually be inserted (after the dedup check), and consider hysteresis on "worst debt" so near-ties don't flip.

### M6 — CSV import still hardcodes USD for fx_rate, inconsistent with the M5 home-currency fix everywhere else
- `lib/actions/csv-import.ts:143` (`account.currency === "USD" ? 1 : null`)
- WS2 M5 fixed exchange/sync/editAccountBalance to use `home_currency`, but the CSV importer was missed and still keys fx_rate on literal `"USD"`. A CAD-home user importing a CAD account gets `fx_rate=null` (treated as unconverted) instead of `1`.
- Why it matters: same class of bug M5 set out to kill; leaves CSV-imported history mis-flagged for non-USD home users.
- Fix direction: pull `profiles.home_currency` and compare against `account.currency` as the other three call sites do.

---

## LOW

### L1 — `ensureLogos` double-queries the cache (admin freshness check + read map)
- `lib/institution-logos.ts:135-138` then `:153` — one admin `SELECT fetched_at`, then a second `getCachedLogosMap` `SELECT`. Minor extra round-trip per render. Fix: have `ensureLogos` select the full columns once and reuse.

### L2 — `hint_events` insert is best-effort but its error is unchecked/unlogged
- `lib/actions/hints.ts:52-58,89-95` — insert result isn't captured; a failed analytics write is silent. Acceptable as "best-effort" but a `console.warn` on `error` would aid debugging. Note RLS requires `auth.uid() = user_id` (correct), and `workspace_id` may be null (allowed by schema).

### L3 — `BankIcon` data-URI img: low but non-zero defacement risk if Plaid returned non-PNG bytes
- `components/BankIcon.tsx:42` — `data:image/png;base64,${logoBase64}` is **not** an XSS/script vector (browsers won't execute script from an `image/png` data URI, and base64 can't break out of the attribute). Realistic worst case: a malformed/oversized payload renders broken or bloats the DOM. Source is Plaid (trusted) via admin upsert, so practically safe. Optional hardening: validate base64 shape + cap length before storing.

### L4 — Timezone picker offers `Europe/*` / `America/Asuncion` but Plaid + product are US-only right now
- `lib/time.ts:67-71` — harmless, but a user can select a tz the rest of the product (US-only Plaid, UTC-based email cron at `sunday-reckoning:25`) doesn't fully honor. The cron *does* now use per-user tz for the idle check (good), but send timing is still fixed 16:00 UTC. Cosmetic mismatch only.

### L5 — `accountsNeedingCheckin` uses `startsWith(today)` on a timestamptz string (UTC) — same off-by-one family as H3
- `app/app/page.tsx:178-181` — `last_acknowledged_at` is a UTC timestamp compared against UTC `today`; an evening ack in a western tz can show "needs check-in" the next morning incorrectly. Folds into the H3 tz fix.

---

## Areas verified clean

- **RLS on the 3 new tables.** `institution_logos` is global public metadata, SELECT-only for `authenticated`, writes via admin client — correct (`20260526120008:19-25`). `plaid_link_token_events` and `hint_events` enable RLS; the former is default-deny (admin-only, correct) and the latter is owner-scoped `auth.uid() = user_id` for both INSERT and SELECT — no cross-user read (`20260526120011:29-39`).
- **SECURITY DEFINER RPC changes.** `accept_workspace_invite` is a faithful superset of the original (`20260526120002:328-372`) — all prior checks retained, expiry inserted between not-found and email checks; `search_path=''` set. `peek_workspace_invite` DROP+CREATE is safe: only caller is the accept-invite page via `supabase.rpc` (`accept-invite/[token]/page.tsx:30`), no SQL dependency on the return shape; grant to `authenticated, anon` matches the original.
- **Link-token rate limit** (`link-token/route.ts:21-33`) is server-side, keyed on authenticated `user.id` via admin client against an RLS-protected table — not client-bypassable. 15/hr cap is reasonable.
- **`addDaysISO`/`daysBetweenISO` noon-UTC anchor** (`lib/time.ts:42-55`) is correct: anchoring at `T12:00:00Z` and doing pure `setUTCDate` arithmetic avoids any DST/offset flipping the date component; `localDateISO` correctly delegates rollover to `Intl.DateTimeFormat` and has a sane invalid-tz → default → UTC fallback chain.
- **Streak continuation math** (`checkin.ts:70-73`) correctly uses `addDaysISO(today,-1)` in user tz and guards re-counting via `last_checkin_date === today`. The projected `streakAfter` in `checkin/page.tsx:126` is correct (bumps only if today not already counted).
- **`ask.ts` placeholder race pattern** (`:120-149,259-268`) — insert-first-then-recount with `> DAILY_CAP` and rollback-on-over/failure is monotonic and correct; the L3 authoritative recount after success is right.
- **Migrations idempotency** — all four use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP POLICY IF EXISTS`. The two `NOT NULL` additions both supply a DEFAULT (`profiles.timezone` default `America/New_York`; no un-backfilled NOT NULL), and invite-expiry backfills in-flight rows before relying on the column. Safe to re-run.
- **CSV quote-aware parser** (`csv-import.ts:37-65`) correctly handles quoted commas and `""` escapes for the single-line case it targets.
- **Email skipped vs failed state** (`email/send.ts:14-22,44-46`) cleanly distinguishes "no API key" (benign skip) from real send failure; cron consumes it correctly (`sunday-reckoning:153-160`).
