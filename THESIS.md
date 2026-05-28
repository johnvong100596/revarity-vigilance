# Vigilance — Thesis, Aesthetic, Hints Library & Reference Implementation

**Companion to:** `vigilance-ARCHITECTURE.md`
**Purpose:** Give Claude Code the *why*, the *how it should look*, and the *complete hints engine taxonomy*
**Owner:** Cena
**Status:** Locked

---

## 1. The Thesis (read first, every session)

> **"Finance is like your widow. The moment you stop paying attention to her, she comes back to bite you in the ass."**

Most people fail with money not because they make bad decisions — they fail because they **stop looking.** Balances drift. Debt compounds quietly. Subscriptions bleed. By the time you check in, the damage is done.

**Vigilance exists to make sure that never happens.** It's not a tracker. It's not a budget app. It's a **daily 30-second ritual** that keeps your money in front of you, every single day, forever.

Personal/internal tool for Cena (CTO of Revarity) and team — now with a public marketing landing at `vigilance.revarity.com` for waitlist / friends-and-family access.

**Aesthetic (v2, locked 2026-05-25):** premium, calm, ritualistic — Wealthsimple × Apple × Tesla. **Cream-on-light with signal-red accents** — single palette across the public marketing landing (`vigilance.revarity.com`) *and* the authenticated app (`/app/*`). Heavy weights for hero typography, pill-shaped CTAs. **Typography is split by surface — see the Typography Split section below** (app = Inter only; marketing = Fraunces headings + Inter body + JetBrains Mono metadata; confirmed 2026-05-27).

> *Aesthetic v1 archived:* the original brief was gold-on-dark (Apple Fitness × Linear × Copilot Money). After the v1 landing shipped on May 25 the owner pivoted to a Wealthsimple-adjacent bright palette + Apple/Tesla-style sans for both marketing and the authed app. The v3 reference HTML in §5 below still shows the v1 visual treatment — read it as a structural reference (sections, rhythm, content hierarchy), not chromatic. Live tokens are in ARCHITECTURE.md §9.

## Typography Split

The Vigilance product family uses TWO distinct typography systems for two distinct purposes:

### APP surfaces (where users live daily)
Routes: /app/*, /checkin, /settings, /accounts/*, /subscriptions, /ask
Font: Inter throughout
Why: Inter is the most legible UI font for non-technical users. Looks like the apps they already know (Twitter, GitHub, Instagram web, Stripe). Brain-dead readable on any screen size, any age, any background.

### MARKETING + Document surfaces
Routes: / (landing), /privacy, /terms, marketing emails
Font: Fraunces (serif) for headings + Inter for body + JetBrains Mono for metadata
Why: Premium feel for the moments where we're SELLING the product. Editorial quality differentiates us from Mint/Monarch/Quicken which look like 2018 fintech.

NEVER mix the two. App surfaces are Inter only. Marketing surfaces use Fraunces sparingly for headings.

> *Implementation:* fonts are declared in `app/layout.tsx` as CSS variables and exposed in Tailwind as `font-fraunces` (headings) and `font-meta` (JetBrains Mono metadata). `font-meta` is deliberately NOT named `font-mono` — overriding Tailwind's built-in `font-mono` would pull JetBrains into any app route that uses it (e.g. the CSV import panel). The browser only downloads Fraunces/JetBrains on routes that use these classes, so `/app/*` stays Inter-only with zero extra font payload. Marketing email headings use a `Georgia, serif` fallback (Fraunces isn't email-safe).

---

## 2. Two Selling Features

### Feature 1 — The Daily Swipe Check-In

**What it is:**
Open the app once a day. See every account you own as a card — Mercury, Scotiabank, Visa, mortgage, car loan, crypto, every investment. Swipe through them like Tinder. One tap = "I see you." Takes 30 seconds.

**How to use it:**
1. Open app in the morning with coffee
2. Each account appears as a swipeable card with current balance + change since yesterday
3. Swipe right = acknowledged ✅
4. Swipe up = something's wrong, let me update
5. After all accounts swiped → "Daily check complete. Net worth: $X. Awareness streak: 47 days 🔥"

**Why we designed it this way:**
- **Speed = adoption.** If it takes 5 minutes, you'll skip it. 30 seconds = no excuse.
- **Tactile = memorable.** Swiping each account physically forces you to register the number. Your brain encodes it.
- **One screen, one job.** No menus, no setup, no friction. Open → swipe → close.

### Feature 2 — The Expert Hints Layer

**What it is:**
A CFO-grade insights engine that surfaces what financial experts see automatically — the patterns normal people miss. Mortgage renewal windows. Debt prioritization math. Credit utilization warnings. Bank product launches. Tax residency tracking.

**How to use it:**
- Bell icon top-right of home shows count of active hints (red number badge)
- One hint surfaces directly on home screen (the highest-severity one)
- Tap bell → full hints library, organized by category:
  - 🔴 **PAY ATTENTION** — things actively costing money right now
  - 🟡 **OPPORTUNITIES** — money on the table you don't see
  - 🟢 **STRATEGIC** — portfolio-level lens, long game

**Why we designed it this way:**
- **95% of people don't have a CFO.** This app is your CFO.
- **Surfacing > storing.** Every other finance app shows you balances. This one tells you what to *do* with them.
- **This is the moat.** Anyone can clone a tracker. Nobody else will maintain a curated hints engine.

---

## 3. The Rituals (defined here for first time)

### Sunday Reckoning (10 min, every Sunday evening)
Weekly structured check-in beyond daily swiping:
- 7-day net worth chart (Mon–Sun)
- Biggest movers — top 3 accounts that changed most, why
- Payments incoming this week
- One reflection prompt: *"What financial decision do you need to make this week?"*
- Saves to journal — looked back at during Monthly Close

**Why:** Daily swiping prevents drift but weekly review prevents *strategic blindness*. You can swipe healthy numbers for 30 days and miss that your runway is shrinking 2%/week.

### Monthly Close (20 min, last day of month)
The deeper review:
- Full month net worth chart
- **Waterfall view** — where money actually went (taxes / buffer / RevOS / STR / distributions per your capital allocation rules)
- Wins (e.g., "Paid down mortgage by $1,840") and Drags (e.g., "Visa utilization hit 78%")
- All 4 weekly reflections reviewed in one place
- Snapshot saved — locks the month, generates a record

**Why:** This is the "annual report for yourself, every 30 days." Most people review finances yearly. Vigilance forces it monthly. Over a decade, that's the difference between coasting and compounding.

---

## 4. The Decay System (the killer visual mechanic)

The longer you ignore the app, the more visibly your financial picture **decays on screen.**

- **Day 1 missed:** Subtle yellow dot on home screen
- **Day 3 missed:** Account cards desaturate, "Unchecked 3 days" badges appear
- **Day 5 missed:** Background darkens, red pulse begins
- **Day 7+ missed:** Full-screen takeover. "You haven't checked in 9 days. Let's go account by account. Now."

**Why this matters:**
- **The decay IS the lesson.** Your money is actually doing this when you ignore it — we're just making the invisible visible.
- **Loss aversion > reward seeking.** People work harder to avoid losing a streak than to gain a reward. Duolingo built a $6B company on this.
- **The app teaches the thesis through your own experience.** You feel the drift in the UI before it costs you in real life.

---

## 5. What This Looks Like (Reference Implementation)

The HTML below is the locked v3 design. Translate to React/Tailwind/Framer Motion. Don't change the visual language.

### Home Screen Layout (top to bottom)

1. **Header row:** menu icon (settings) left, bell icon (hints, with red badge count) right
2. **Net worth display** — small "NET WORTH" label + USD badge, then big serif (Georgia) number, then change + streak below
3. **Daily check-in card** — red-bordered, "X accounts to acknowledge," arrow right
4. **Expert Hint preview card** — top hint surfaced directly on home (severity-colored left border: red for pay_attention, red for opportunity, teal for strategic)
5. **Accounts list** — each row: type-keyed left edge marker (red for bank/cash, purple for investment, amber for crypto, warm-red for loans), name + subtitle, balance + change
6. **Sunday + Monthly cards** — two small cards bottom

### Reference HTML (the locked v3 widget)

```html
<div id="v3" style="background: #0A0E1A; border-radius: 24px; max-width: 380px; margin: 0 auto; overflow: hidden; border: 0.5px solid rgba(212, 175, 55, 0.15); font-family: var(--font-sans);">

<div id="v3-home" style="padding: 22px 20px 28px; min-height: 740px;">

<!-- Header -->
<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
  <div onclick="v3go('settings')" style="color: #8B92A5; cursor: pointer;"><i class="ti ti-menu-2" style="font-size: 20px;"></i></div>
  <div onclick="v3go('hints')" style="position: relative; color: #D4AF37; cursor: pointer;">
    <i class="ti ti-bulb" style="font-size: 20px;"></i>
    <div style="position: absolute; top: -4px; right: -6px; min-width: 14px; height: 14px; border-radius: 7px; background: #C8553D; color: #FFFFFF; font-size: 9px; font-weight: 500; display: flex; align-items: center; justify-content: center; padding: 0 4px;">4</div>
  </div>
</div>

<!-- Net worth -->
<div style="margin-bottom: 22px;">
  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
    <div style="font-size: 10px; letter-spacing: 2px; color: #8B92A5;">NET WORTH</div>
    <div style="font-size: 10px; color: #D4AF37; background: rgba(212, 175, 55, 0.1); padding: 2px 6px; border-radius: 4px;">USD</div>
  </div>
  <div style="font-family: Georgia, serif; font-size: 40px; color: #F5F5F0; line-height: 1;">$1,247,832</div>
  <div style="font-size: 12px; color: #6FA76F; margin-top: 6px;"><i class="ti ti-arrow-up-right" style="font-size: 12px;"></i> $3,420 today · 47<i class="ti ti-flame" style="font-size: 11px;"></i></div>
</div>

<!-- Daily check-in CTA -->
<div onclick="v3go('checkin')" style="background: #1C2333; border: 0.5px solid rgba(212, 175, 55, 0.4); border-radius: 14px; padding: 14px; margin-bottom: 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
  <div>
    <div style="font-size: 14px; color: #F5F5F0; font-weight: 500;">Daily check-in</div>
    <div style="font-size: 11px; color: #8B92A5;">8 accounts to acknowledge</div>
  </div>
  <div style="color: #D4AF37;"><i class="ti ti-arrow-right" style="font-size: 18px;"></i></div>
</div>

<!-- Hint preview card on home -->
<div style="background: rgba(212, 175, 55, 0.06); border: 0.5px solid rgba(212, 175, 55, 0.3); border-radius: 12px; padding: 12px; margin-bottom: 20px; cursor: pointer;" onclick="v3go('hints')">
  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
    <div style="display: flex; align-items: center; gap: 6px;">
      <i class="ti ti-sparkles" style="font-size: 13px; color: #D4AF37;"></i>
      <div style="font-size: 10px; letter-spacing: 1.5px; color: #D4AF37;">EXPERT HINT</div>
    </div>
    <i class="ti ti-chevron-right" style="font-size: 14px; color: #D4AF37;"></i>
  </div>
  <div style="font-size: 12px; color: #F5F5F0; line-height: 1.5;">Your car loan at 6.49% is your worst-weighted debt. <span style="color: #D4AF37;">Pay this first</span> — 7% guaranteed return beats Duvelt's risk.</div>
</div>

<!-- Account row (each row in the list looks like this) -->
<div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #1C2333; position: relative;">
  <div style="position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 3px; height: 24px; background: #D4AF37; border-radius: 0 2px 2px 0;"></div>
  <div>
    <div style="font-size: 12px; color: #F5F5F0; margin-bottom: 2px;">Mercury</div>
    <div style="font-size: 10px; color: #8B92A5;">Business · USD</div>
  </div>
  <div style="text-align: right;">
    <div style="font-size: 13px; color: #F5F5F0; font-variant-numeric: tabular-nums; font-weight: 500;">$42,180</div>
    <div style="font-size: 10px; color: #6FA76F;"><i class="ti ti-arrow-up-right" style="font-size: 9px;"></i> +$1,200</div>
  </div>
</div>

</div>
</div>
```

### Hints Page Layout (when bell tapped)

Three category sections with color-coded left borders on each hint card:
- 🔴 **PAY ATTENTION · 2** — `border-left: 2px solid #C8553D`
- 🟡 **OPPORTUNITIES · 2** — `border-left: 2px solid #D4AF37`
- 🟢 **STRATEGIC · 2** — `border-left: 2px solid #6FA76F`

Each hint card: icon + category label, body text with key numbers in **accent red** (formerly gold in v1 — see §1 aesthetic pivot note), two action buttons (Dismiss + Got it).

---

## 6. EXPERT HINTS LIBRARY (the complete taxonomy — v1 implements 6, full library is the roadmap)

### Hint Architecture

Every hint has 6 fields:
- **ID** — unique slug (e.g. `H-001`)
- **Category** — `pay_attention` | `opportunity` | `strategic`
- **Trigger** — the data condition
- **Data needed** — required account/market data
- **Copy template** — dynamic text with `{variables}`
- **Action** — buttons + their behavior

Engine runs nightly (cron) + on every account update. Each hint can fire at most once per N days. Severity scoring:
```
score = base × time_decay × dismiss_penalty
  base: pay_attention=100, opportunity=60, strategic=40
  time_decay: 1.0 if <3 days, 0.7 if 3-14, 0.4 if >14
  dismiss_penalty: 1 - (dismissed_count × 0.3)
```

3 dismisses = effectively muted unless conditions change >20%.

---

### CATEGORY 1 — PAY ATTENTION (Red, urgent)

#### H-001 · Debt prioritization (APR vs investment return) ⭐ V1
- **Trigger:** Any debt's APR > (user's average investment return × 0.7)
- **Data needed:** All debts with APR + recent 90-day average return across investment accounts
- **Copy:** *"Your {debt_name} at {apr}% is your worst-weighted debt. Paying it off = ~{apr}% guaranteed return vs {investment_name}'s {investment_return}% market risk. Pay this before adding to investments."*
- **Action:** `[Plan payoff]` → opens payoff calculator
- **Refire:** Every 30 days until cleared or dismissed 3×
- **Cena example:** Car loan 6.49% vs Duvelt 9.6%/mo → fires

#### H-002 · Credit utilization danger ⭐ V1
- **Trigger:** Card balance / limit > 70% AND statement close within 7 days
- **Data needed:** Card balance, credit limit, statement close date
- **Copy:** *"{card_name} hits {utilization}% utilization in {days} days at statement close. Pay {payment_needed} by {target_date} to keep under 30% — preserves credit score for upcoming credit needs."*
- **Action:** `[Open {bank} portal]`
- **Refire:** Weekly while above threshold

#### H-003 · Missed payment risk
- **Trigger:** Debt payment due within 3 days AND linked account balance < payment × 1.5
- **Copy:** *"{debt_name} payment of {amount} due in {days} days. Available cash buffer is {buffer_ratio}× — transfer funds or set up backup payment now."*
- **Action:** `[Open {bank} portal]` · `[Mark resolved]`
- **Refire:** Daily until resolved

#### H-004 · Cash position critical
- **Trigger:** Total liquid cash < (3 months of fixed expenses)
- **Copy:** *"Liquid cash buffer is {months} months of fixed expenses. Industry standard for {user_role}: 6+ months. Slow distributions and replenish before new commitments."*
- **Action:** `[See expense breakdown]` · `[Dismiss for 7 days]`
- **Refire:** Weekly

#### H-005 · Investment drawdown alarm
- **Trigger:** Single investment account down > 15% in 30 days
- **Copy:** *"{investment_name} down {drawdown}% in 30 days. Review whether system is functioning as designed or if intervention needed."*
- **Action:** `[Open broker portal]` · `[Note for Sunday Reckoning]`
- **Refire:** Daily until recovered or acknowledged
- **Cena example:** Duvelt grid EA failure mode 12–18 months — this is the early warning

#### H-006 · Subscription / recurring cost drift
- **Trigger:** Recurring outflows > 105% of 90-day baseline
- **Copy:** *"Recurring outflows from {account_name} are {percentage}% above your 3-month baseline. Audit subscriptions — typical drift here is {amount}/mo in stale services."*
- **Action:** `[See transactions]` · `[Dismiss]`
- **Refire:** Monthly

---

### CATEGORY 2 — OPPORTUNITIES (Gold, action-available)

#### H-101 · Mortgage renewal window ⭐ V1
- **Trigger:** Mortgage renewal within 18 months AND current rate > best market rate by >50bps
- **Data needed:** Mortgage rate + renewal date + live Canadian rate feed (Ratehub.ca API)
- **Copy:** *"{central_bank} cut {recent_change}. Your mortgage renews in {months} months at {current_rate}%. Major banks now offering {best_rate}% {term} fixed. Start shopping now — could save ~{annual_savings}/yr."*
- **Action:** `[Compare rates]` → Ratehub.ca · `[Set reminder 3mo before renewal]`
- **Refire:** Every 60 days in renewal window

#### H-102 · Bank product launch (your existing banks)
- **Trigger:** User's connected bank launches new product user is eligible for
- **Data needed:** Manual curation feed + user credit profile + relationship type
- **Copy:** *"{bank_name} rolled out {product_type} this week. Your credit profile ({credit_score}+) likely qualifies for {estimated_offer}. Useful for {use_case_relevant}."*
- **Action:** `[Apply now]` · `[Learn more]` · `[Dismiss]`
- **Refire:** Once per product, ever
- **Cena example:** Scotiabank instant-approval LOC for STR acquisitions

#### H-103 · HISA / GIC rate arbitrage ⭐ V1
- **Trigger:** User has > $25K cash earning < 2% AND a HISA/GIC > 4% exists
- **Copy:** *"{amount} sitting in {low_yield_account} earning ~{current_rate}%. Moving to {best_hisa_name} at {best_rate}% = ~{annual_gain}/yr extra. 5-min transfer."*
- **Action:** `[Compare HISAs]` · `[Dismiss for 30 days]`
- **Refire:** Quarterly

#### H-104 · Credit card welcome bonus eligible
- **Trigger:** Monthly spend > $4K AND no new card in 12 months AND active welcome bonus
- **Copy:** *"You spend ~{monthly_spend}/mo and haven't opened a new card in {months} months. {card_name} offering {welcome_bonus} for spending {required_spend} you'd already do."*
- **Action:** `[See card details]` · `[Dismiss]`
- **Refire:** Once per card, ever
- **Note:** Pairs with Cena's 14-bank credit expansion strategy

#### H-105 · Mortgage prepayment optimal moment
- **Trigger:** Mortgage anniversary window AND surplus cash > 1.5× prepayment allowance
- **Copy:** *"Mortgage prepayment privilege window opens {date}. You can pay {max_prepay} without penalty. At {rate}% rate, this saves ~{lifetime_savings} over loan life."*
- **Action:** `[Calculate impact]` · `[Open lender portal]`
- **Refire:** Once per anniversary

#### H-106 · FX timing for cross-currency holders
- **Trigger:** User has > $10K in non-home currency AND currency trading > 1 std dev from 90-day mean
- **Copy:** *"USD/CAD currently {current_rate} vs 90-day average {avg_rate}. Converting {converting_amount} CAD now nets ~{difference} more USD than 30-day average. Window may not last."*
- **Action:** `[Open Wise / bank FX]` · `[Snooze 7 days]`
- **Refire:** Weekly while outside band

---

### CATEGORY 3 — STRATEGIC (Green, long-game)

#### H-201 · Portfolio weighting imbalance ⭐ V1
- **Trigger:** Any asset class > 1.5x or < 0.5x industry benchmark for user's role
- **Copy:** *"Cash position is {cash_pct}% of net worth. {benchmark_role} typically hold {benchmark_range}%. You're either over-reserving ({drag_implication}) or signaling you don't trust the deployment plan."*
- **Action:** `[Review waterfall]` · `[Adjust target]`
- **Refire:** Monthly
- **Cena example:** 31% cash vs 15–20% STR operator benchmark

#### H-202 · Tax residency day-count tracking ⭐ V1
- **Trigger:** International user AND day-count in any country > 50% of legal threshold YTD
- **Copy:** *"You've been in {country} {days} days YTD. {threshold_label} = {remaining} days remaining. Track carefully through {remaining_quarters}."*
- **Action:** `[Open tax calendar]` · `[Add manual day]`
- **Refire:** Monthly; weekly when within 30 days of threshold
- **Cena example:** CRA 183-day non-residency tracking

#### H-203 · Distribution-vs-reinvest waterfall imbalance
- **Trigger:** Monthly distributions exceed waterfall stage rules
- **Copy:** *"Personal distributions of {amount} this month exceed waterfall stage ({current_stage}). At your stage, should be < {recommended_max}. Either revise plan or pause distributions."*
- **Action:** `[Review waterfall]` · `[Justify exception]`
- **Refire:** Monthly

#### H-204 · Investment correlation concentration
- **Trigger:** Single position / strategy > 30% of liquid net worth
- **Copy:** *"{position_name} is {pct}% of your liquid net worth. Concentration risk: single failure mode wipes >25%. Consider diversification or hedge."*
- **Action:** `[See exposure]` · `[Dismiss]`
- **Refire:** Monthly
- **Cena example:** Duvelt at high % of liquid net worth

#### H-205 · Insurance coverage vs net worth gap
- **Trigger:** Net worth × 0.5 > total life/disability coverage
- **Copy:** *"Net worth is {net_worth}. Current coverage is {coverage}. Standard is 10x annual income or 50% of net worth, whichever lower. Gap: {gap_amount}."*
- **Action:** `[Get quotes]` · `[Update coverage]`
- **Refire:** Every 90 days

#### H-206 · Estate / structural planning trigger
- **Trigger:** Net worth crosses thresholds ($1M, $5M, $10M, $25M)
- **Copy:** *"Net worth just crossed {threshold}. At this level, you should have: {checklist_for_threshold}. Time for a CPA + estate lawyer review."*
- **Action:** `[See checklist]` · `[Find advisor]`
- **Refire:** Once per threshold, ever

#### H-207 · Currency / structural arbitrage
- **Trigger:** Tax-favorable jurisdiction (Paraguay 0% territorial) AND gains realized through high-tax jurisdiction structure
- **Copy:** *"{tax_jurisdiction} territorial tax — gains routed through {favorable_entity} are {tax_rate}. {amount} realized through {high_tax_entity} this month was unnecessarily exposed."*
- **Action:** `[Plan restructure]` · `[Note for CPA]`
- **Refire:** Monthly
- **Cena example:** Paraguay tax residency

#### H-208 · Compounding milestone projection
- **Trigger:** First of month, every month
- **Copy:** *"At your current trajectory ({30d_growth_rate}/mo, {savings_rate}% savings), you cross {next_milestone} in {projected_months} months. Stay the course."*
- **Action:** `[See projection]` · `[Adjust scenario]`
- **Refire:** Monthly (encouragement, not warning)

---

### CATEGORY 4 — RITUAL CONTEXT (embedded in Sunday Reckoning + Monthly Close, not surfaced as alerts)

#### H-301 · Week-over-week velocity
- **Trigger:** Sunday Reckoning generation
- **Copy:** *"This week's net worth velocity: {delta}/wk. Last 4-week average: {avg_delta}/wk. You are {on_pace | accelerating | decelerating} on your annual target."*

#### H-302 · Spending category drift
- **Trigger:** Monthly Close generation
- **Copy:** *"This month vs 90-day baseline: {top_3_categories_up} up, {top_3_categories_down} down. Biggest line: {biggest_line} at {amount}, +{change}% vs baseline."*

#### H-303 · Habit reinforcement
- **Trigger:** Streak milestones (7, 30, 100, 365 days)
- **Copy:** *"{days} days of vigilance. You've checked in {check_count} times this period. Estimated time spent: {time_minutes} min. Estimated drift prevented: priceless."*

---

## 7. V1 Hint Implementation (the 6 to ship)

```
V1 ships these 6 hints — they cover ~70% of real value:

H-001 Debt prioritization        (PAY ATTENTION)
H-002 Credit utilization         (PAY ATTENTION)
H-101 Mortgage renewal           (OPPORTUNITY)
H-103 HISA arbitrage             (OPPORTUNITY)
H-201 Portfolio weighting        (STRATEGIC)
H-202 Tax residency tracking     (STRATEGIC)
```

Each rule lives in `lib/hints-engine/rules/H00X-name.ts` and exports `evaluate(context) → Hint | null`.

Templates inject user data, then optionally pass through Claude API for natural phrasing refinement (the "compose-copy" step) before saving to the `hints` table.

---

## 8. Animation Spec (LOCKED)

### Daily check-in swipe ritual
- Tinder-style stacked cards, one per account
- Swipe right (acknowledge): translateX(+120%), rotate(+15°), opacity → 0 over 350ms cubic-bezier(0.4, 0, 0.2, 1)
- Swipe up (flag): translateY(-120%), slight rotation
- Progress ring on home updates after each swipe
- All-complete: full-screen completion view, streak +1, "See you tomorrow"

### Net worth count-up
- On load: animate 0 → actual value over 800ms ease-out
- On update: animate old → new

### Decay indicators
- Days 1–2: no visual change
- Day 3+: yellow dot next to account name
- Day 7+: account row desaturates (`filter: grayscale + opacity 0.7`)
- Day 14+: full-screen REENGAGE takeover blocking navigation

### Hint card entry
- Slide up + fade in on home, 400ms delay after net worth animates
- Stagger by 80ms when multiple hints render in `/hints`

---

## 9. Edge Cases to Handle Correctly

1. **First account is in non-USD** — net worth shows in user's home_currency, converted
2. **Plaid item disconnects** — show "Reconnect" banner on affected accounts, don't break net worth calc
3. **FX rate fetch fails** — use last cached rate, show subtle "FX rate from {date}" indicator
4. **Hint fires for archived account** — auto-mute, don't surface
5. **User dismisses same hint 3× then conditions change >20%** — re-fire as new hint with note "Conditions changed since last dismissal"
6. **Monthly Close run before all weekly reckonings completed** — show prompt: "You have 2 missed weekly reckonings. Skip or backfill?"
7. **CSV import with mismatched currency** — prompt user to confirm currency before import
8. **Crypto wallet with 0 balance** — still show, mark as "Empty wallet" — useful for tracking holdings post-sell

---

## 10. Tone of Voice (for hint copy + UI)

| Do | Don't |
|---|---|
| "Your car loan at 6.49% is your worst debt." | "You might consider looking at your debts..." |
| "Pay this first." | "It could be a good idea to think about prioritizing..." |
| "$3,420 outflow this week." | "Here's a friendly summary of your weekly spending!" |
| "47 days. Don't break the streak." | "🎉 Wow! 47 days! You're crushing it! 🔥" |

Cena's user preference: **Direct, no filter.** Apply to all copy.

---

## 11. Bank Products Curation Feed (you maintain weekly)

The `bank_products` table is fed manually. You (or a VA) add 2–5 entries per week. Format:

```json
{
  "institution_name": "Scotiabank",
  "product_type": "loc",
  "product_name": "Scotia Plan Instant-Approval LOC",
  "description": "Unsecured line of credit with 24-hour approval. Prime + 1.5% for qualified borrowers (credit score 760+).",
  "rate_or_offer": "Prime + 1.5%",
  "url": "https://www.scotiabank.com/...",
  "jurisdictions": ["CA"],
  "active": true,
  "expires_at": "2026-06-30"
}
```

H-102 only fires for products where user has connected accounts at that institution AND meets the implied credit profile.

---

## 12. What NOT to Build (re-emphasis)

- ❌ Transaction categorization or budgeting
- ❌ Bill pay execution
- ❌ Investment trade execution
- ❌ Tax filing prep
- ❌ Receipt scanning
- ❌ Net worth scenario modeling beyond simple projection
- ❌ Beneficiary / estate data
- ❌ Multi-user shared accounts
- ❌ Push notifications (v1)
- ❌ Light mode (dark only)

If you find yourself building any of the above → STOP, ask owner.

---

## End of Vigilance Companion Doc

Pair with `vigilance-ARCHITECTURE.md` for the full handoff. Both files together = complete spec.
