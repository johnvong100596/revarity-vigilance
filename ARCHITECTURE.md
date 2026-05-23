# Vigilance — Architecture & Build Spec

**Project:** Vigilance — Personal Finance Ritual App
**Owner:** Cena (Revarity)
**Status:** LOCKED. Do not modify Type-2 decisions without owner approval.
**Last updated:** May 21, 2026

---

## 1. Thesis (read this first, every session)

> **"Finance is like your widow. Ignore her, and she comes back to bite you."**

Vigilance is a daily 30-second financial check-in ritual. It is NOT a budgeting app, NOT a transaction categorizer, NOT a robo-advisor. It is a ritualized attention surface that prevents financial drift.

**Killer feature:** the Expert Hints layer — CFO-grade insights surfaced from rules + Claude API. The patterns financial experts see that normal people miss.

Premium, calm, ritualistic aesthetic — Apple Fitness × Linear × Copilot Money. Gold-on-dark.

---

## 2. Tech Stack (LOCKED)

| Layer | Choice |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + shadcn/ui |
| Animation | Framer Motion |
| Auth + DB | Supabase (Postgres + Auth + RLS + Edge Functions) |
| AI | Anthropic API (Claude Sonnet 4) |
| Bank data | Plaid (sandbox → production) |
| FX rates | exchangerate-api.com (~$10/mo) |
| Crypto | CoinGecko Free API |
| Charts | Recharts |
| Hosting | Vercel |
| PWA | next-pwa |
| State | Zustand (global) + useState (local) |
| Forms | React Hook Form + Zod |
| Encryption | Supabase Vault for Plaid access tokens |

**Do NOT add:** Direct bank APIs, Mint-style categorization, broker APIs beyond Plaid, crypto exchange APIs beyond CoinGecko, Prisma.

---

## 3. Database Schema (LOCKED)

All tables RLS-enabled (`auth.uid() = user_id`), all have `created_at` / `updated_at`.

### profiles
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  role_context TEXT,
  home_currency TEXT DEFAULT 'USD',
  jurisdictions TEXT[] DEFAULT ARRAY['CA','PY'],
  awareness_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  last_checkin_date DATE,
  capital_waterfall JSONB,
  expert_hints_enabled BOOLEAN DEFAULT true,
  decay_warnings_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### accounts
```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subtitle TEXT,
  account_type TEXT NOT NULL,       -- 'bank'|'crypto'|'investment'|'loan'|'cash'
  category TEXT NOT NULL,           -- 'asset'|'debt'
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  apr NUMERIC(5,2),
  min_payment NUMERIC(12,2),
  payment_due_day INTEGER,
  renewal_date DATE,
  credit_limit NUMERIC(12,2),
  statement_close_day INTEGER,
  source TEXT NOT NULL DEFAULT 'manual',   -- 'plaid'|'manual'|'csv'|'crypto_api'
  plaid_account_id TEXT,
  plaid_item_id UUID,
  crypto_symbol TEXT,
  crypto_quantity NUMERIC(20,8),
  quick_login_url TEXT,
  last_acknowledged_at TIMESTAMPTZ,
  last_balance_updated_at TIMESTAMPTZ,
  position INTEGER DEFAULT 0,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_accounts_user_active ON accounts(user_id) WHERE archived = false;
```

### plaid_items
```sql
CREATE TABLE plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_item_id TEXT NOT NULL UNIQUE,
  access_token_encrypted TEXT NOT NULL,
  institution_name TEXT,
  institution_id TEXT,
  status TEXT DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### balance_snapshots
```sql
CREATE TABLE balance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(14,2) NOT NULL,
  balance_home_currency NUMERIC(14,2) NOT NULL,
  fx_rate NUMERIC(10,6),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_snapshots_user_date ON balance_snapshots(user_id, captured_at DESC);
```

### check_ins
```sql
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  action TEXT NOT NULL,             -- 'acknowledged'|'flagged'|'updated'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, account_id, checkin_date)
);
```

### hints
```sql
CREATE TABLE hints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hint_template_id TEXT NOT NULL,   -- 'H-001'|'H-101'|etc.
  category TEXT NOT NULL,           -- 'pay_attention'|'opportunity'|'strategic'
  severity_score INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data_snapshot JSONB,
  related_account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  action_label TEXT,
  action_target TEXT,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active'|'dismissed'|'acted'|'muted'
  dismissed_count INTEGER DEFAULT 0,
  fired_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);
CREATE INDEX idx_hints_user_active ON hints(user_id, fired_at DESC) WHERE status = 'active';
```

### bank_products
Manually curated feed for H-102 (bank product launches).
```sql
CREATE TABLE bank_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_name TEXT NOT NULL,
  product_type TEXT NOT NULL,
  product_name TEXT NOT NULL,
  description TEXT NOT NULL,
  rate_or_offer TEXT,
  url TEXT,
  jurisdictions TEXT[] DEFAULT ARRAY['CA','US'],
  active BOOLEAN DEFAULT true,
  expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### fx_rates
```sql
CREATE TABLE fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  rate NUMERIC(10,6) NOT NULL,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(base_currency, target_currency, DATE(captured_at))
);
```

### weekly_reflections
```sql
CREATE TABLE weekly_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_starting DATE NOT NULL,
  reflection_text TEXT,
  net_worth_start NUMERIC(14,2),
  net_worth_end NUMERIC(14,2),
  biggest_movers JSONB,
  payments_summary JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_starting)
);
```

### monthly_closes
```sql
CREATE TABLE monthly_closes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,              -- '2026-04'
  net_worth NUMERIC(14,2),
  monthly_change NUMERIC(14,2),
  waterfall_breakdown JSONB,
  wins JSONB,
  drags JSONB,
  notes TEXT,
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month)
);
```

---

## 4. File Structure

```
vigilance/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (auth)/callback/route.ts
│   ├── (app)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Home
│   │   ├── checkin/page.tsx          # Swipe ritual
│   │   ├── accounts/
│   │   │   ├── [id]/page.tsx
│   │   │   ├── [id]/edit/page.tsx
│   │   │   └── add/page.tsx
│   │   ├── hints/page.tsx
│   │   ├── reckoning/page.tsx        # Sunday Reckoning
│   │   ├── close/page.tsx            # Monthly Close
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── plaid/
│   │   │   ├── link-token/route.ts
│   │   │   ├── exchange/route.ts
│   │   │   ├── webhook/route.ts
│   │   │   └── sync/route.ts
│   │   ├── hints/
│   │   │   ├── compute/route.ts
│   │   │   ├── dismiss/route.ts
│   │   │   └── act/route.ts
│   │   ├── fx/route.ts
│   │   └── snapshot/route.ts
│   └── layout.tsx
├── components/
│   ├── ui/
│   ├── AccountRow.tsx
│   ├── NetWorthDisplay.tsx
│   ├── SwipeCard.tsx
│   ├── HintCard.tsx
│   ├── ProgressRing.tsx
│   ├── WaterfallChart.tsx
│   ├── NetWorthChart.tsx
│   └── DecayIndicator.tsx
├── lib/
│   ├── supabase/{client,server,middleware}.ts
│   ├── plaid.ts
│   ├── hints-engine/
│   │   ├── index.ts                  # computeHints(userId)
│   │   ├── rules/
│   │   │   ├── H001-debt-priority.ts
│   │   │   ├── H002-credit-utilization.ts
│   │   │   ├── H101-mortgage-renewal.ts
│   │   │   ├── H103-hisa-arbitrage.ts
│   │   │   ├── H201-portfolio-weighting.ts
│   │   │   └── H202-tax-residency.ts
│   │   └── compose-copy.ts           # Claude API for hint phrasing
│   ├── fx.ts
│   ├── crypto.ts
│   └── anthropic.ts
├── hooks/
│   ├── useAccounts.ts
│   ├── useNetWorth.ts
│   ├── useHints.ts
│   └── useStreak.ts
├── supabase/
│   ├── migrations/
│   └── functions/
│       ├── nightly-hint-compute/
│       ├── nightly-snapshot/
│       └── fx-refresh/
├── public/{manifest.json, icons/}
├── middleware.ts
└── next.config.js
```

---

## 5. Plaid Integration

### Flow
1. User taps "Connect a bank" → `/api/plaid/link-token` returns Link token
2. Client renders Plaid Link SDK, user auths with bank
3. Plaid returns `public_token` to client
4. Client POSTs to `/api/plaid/exchange` → server swaps for `access_token`
5. Server encrypts via Supabase Vault, stores in `plaid_items`
6. Server immediately fetches `/accounts` + `/liabilities`, creates rows in `accounts` with `source = 'plaid'`
7. Webhooks registered for `TRANSACTIONS`, `HOLDINGS`, `LIABILITIES`

### Sync schedule
- **Realtime:** Plaid webhooks → `/api/plaid/webhook` updates balances
- **Cron:** Nightly Edge Function `nightly-snapshot` writes `balance_snapshots` row per account (regardless of source)
- **Manual:** "Sync now" button in account detail calls `/api/plaid/sync` for that item

### Critical security rules
- `access_token` NEVER leaves server. NEVER exposed to client.
- Encrypted at rest via Supabase Vault.
- Plaid webhook endpoint must verify webhook signature.
- Sandbox first. Apply for Plaid Production access during Day 1 (1–3 day approval).

---

## 6. Hints Engine

See full library in `hints-library.md`. v1 ships with 6 hints:

| ID | Trigger |
|---|---|
| H-001 | Debt APR > investment return × 0.7 |
| H-002 | Card utilization > 70% within 7 days of statement close |
| H-101 | Mortgage renewal within 18mo + current rate > market by >50bps |
| H-103 | Cash > $25K in <2% account while HISA > 4% available |
| H-201 | Asset class > 1.5x or < 0.5x role benchmark |
| H-202 | Day-count in any jurisdiction > 50% of threshold YTD |

### Engine flow
1. Cron runs nightly: `nightly-hint-compute` Edge Function
2. For each user: load profile + accounts + recent snapshots + fx_rates
3. Each rule in `lib/hints-engine/rules/` exports `evaluate(context) → Hint | null`
4. For positive evaluations, call `composeCopy()` → Claude API generates the body text using template + user data
5. Insert into `hints` table with severity score
6. Apply de-duplication: if same `hint_template_id` already active and conditions haven't materially changed, skip
7. Auto-mute hints dismissed 3+ times unless conditions change >20%

### Severity scoring
```
score = base × time_decay × dismiss_penalty
  base: pay_attention=100, opportunity=60, strategic=40
  time_decay: 1.0 if <3 days old, 0.7 if 3-14 days, 0.4 if >14 days
  dismiss_penalty: 1 - (dismissed_count × 0.3)
```

Home screen surfaces top 1 hint. `/hints` shows all sorted by score.

---

## 7. Animations Spec (LOCKED)

### Daily check-in swipe ritual
- Tinder-style stacked cards, one per account needing acknowledgment
- Swipe right (acknowledge): card translates +120%, rotates +15°, opacity → 0 over 350ms cubic-bezier(0.4, 0, 0.2, 1)
- Swipe up (flag): translates -120% Y, slight rotation, same easing
- Progress ring on home updates as each card resolves
- On all-complete: full-screen completion view with awareness streak +1, "See you tomorrow"

### Net worth count-up
- On load: animate from 0 to actual value over 800ms with ease-out
- On update: animate between old and new value

### Decay indicators
- Days 1–2 since check-in: no visual change
- Day 3+: yellow dot appears next to account name
- Day 7+: account row desaturates (CSS filter: grayscale + opacity 0.7)
- Day 14+: home screen shows "REENGAGE" full-screen takeover blocking other navigation until at least one account is acknowledged

### Hint card entry
- Slide up + fade in on home screen, 400ms delay after net worth animates
- Stagger by 80ms when multiple hints render in `/hints`

---

## 8. Multi-Currency Logic

### Storage
- Every account stores native `currency` + native `balance`
- `balance_snapshots` ALWAYS includes `balance_home_currency` pre-converted at snapshot time
- FX rate at snapshot time is stored in `fx_rate` column for audit trail

### Display
- Home net worth: ALWAYS in `profiles.home_currency`
- Account row: native currency with symbol prefix (`C$`, `$`, `€`, `₲`)
- Account detail: shows native + home-currency equivalent

### Conversion
- Cron `fx-refresh` runs every 4 hours
- Fetches USD-based rates from exchangerate-api.com
- Stores in `fx_rates` table
- All conversions reference latest row for that pair

---

## 9. Design Tokens (LOCKED — match v3 widget exactly)

```css
:root {
  --bg-primary: #0A0E1A;
  --bg-secondary: #1C2333;
  --bg-tertiary: #161B2A;

  --accent-primary: #D4AF37;      /* gold */
  --accent-soft: rgba(212, 175, 55, 0.12);

  --text-primary: #F5F5F0;
  --text-secondary: #8B92A5;
  --text-muted: #5A5F70;

  --positive: #6FA76F;            /* sage green */
  --negative: #C8553D;            /* warm red */

  --hint-pay-attention: #C8553D;
  --hint-opportunity: #D4AF37;
  --hint-strategic: #6FA76F;

  --crypto-accent: #FBBF24;       /* amber for crypto rows */
  --invest-accent: #A78BFA;       /* purple for investment rows */
}
```

**Fonts:**
- Default: Inter
- Net worth + large numbers: Georgia (serif) for that "ledger / private bank" feel
- Numerics: `tabular-nums`

**Border radius:** 10px (rows), 12px (cards), 14px (hero), 24px (app frame).

---

## 10. Build Order (10-day sprint)

| Day | Deliverable |
|---|---|
| 1 | Repo init, Supabase setup, auth, schema migrations, **APPLY FOR PLAID PRODUCTION ACCESS** |
| 2 | Manual account CRUD, home screen with net worth + accounts list, currency picker |
| 3 | Daily check-in swipe ritual + completion view + streak logic |
| 4 | Account detail screen, edit/delete, account types (crypto via CoinGecko, investment, loan), CSV import stub |
| 5 | Plaid Link integration (sandbox), exchange endpoint, account auto-creation |
| 6 | Plaid webhooks, balance_snapshots cron, fx-refresh cron, settings screen |
| 7 | Hints engine — rules H-001, H-002, H-201 (deterministic ones first) |
| 8 | Hints engine — H-101, H-103, H-202 + Claude API copy composition + /hints page |
| 9 | Sunday Reckoning screen + Monthly Close screen + waterfall chart |
| 10 | Polish, decay animations, PWA, deploy, real account data |

---

## 11. Type-2 Decisions Already Locked

| Decision | Choice |
|---|---|
| Auth | Supabase Auth |
| Bank aggregator | Plaid only |
| Crypto | CoinGecko Free |
| FX | exchangerate-api.com |
| Token storage | Supabase Vault, server-side only |
| Hints engine | Server-side cron + on-demand recompute |
| Hint copy | Templated + Claude API rendered |
| Charts | Recharts |
| Multi-user | Single user per account v1 |
| Currencies in v1 | USD, CAD, EUR, PYG |
| Offline | Skip for v1 |

---

## 12. Claude Code / Lovable May Decide Autonomously

- Component file structure within `components/`
- shadcn/ui variant customization
- Tailwind class compositions
- Supabase query patterns (single vs join vs separate fetches)
- Form validation rules within Zod schemas
- Error message phrasing
- Loading / empty state UI
- Animation easing within spec'd ranges
- TypeScript type composition

## 13. Owner Approval Required Before:

- Adding any dependency not in §2
- Schema changes (new tables / columns)
- Adding new currencies
- Changing hint scoring formula in §6
- Changing design tokens in §9
- Adding any social / sharing features
- Changing AI provider
- Adding new hint rules beyond the v1 six (extend `hints-library.md` first)

---

## 14. Definition of Done (v1)

- [ ] Installs as PWA on iPhone
- [ ] Add bank via Plaid in <60 seconds, accounts auto-populate
- [ ] Add crypto wallet, investment account, loan via manual flow
- [ ] Add cash account manually
- [ ] CSV import works for Scotiabank export
- [ ] Home screen shows net worth in USD with all accounts converted
- [ ] Daily check-in swipe ritual works on touch + click
- [ ] Awareness streak increments daily
- [ ] At least 6 hints can fire correctly based on real data
- [ ] Hints page shows all hints sorted by severity
- [ ] Sunday Reckoning generates correctly with 7-day chart
- [ ] Monthly Close generates with waterfall breakdown
- [ ] Decay system visually triggers after missed days
- [ ] Settings allows currency change, hint toggles, ritual schedule
- [ ] Deployed to chosen domain

---

## 15. Out of Scope for v1 (DO NOT BUILD)

- Transaction-level categorization or budgeting
- Bill pay execution
- Investment trade execution
- Tax filing preparation
- Receipt scanning
- Recurring expense detection beyond cash flow snapshot
- Net worth scenario modeling beyond simple projection
- Beneficiary / estate planning data
- Multi-user shared accounts
- Notifications (SMS, push)
- Native iOS app
- White-label / B2B features

Anything here → backlog, not v1.

---

## 16. Decision Escalation

If Claude Code / Lovable encounters a decision not covered above: **STOP. Ask owner in chat. Do not guess.**

**Owner:** Cena
**Codename:** V1
