import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Flame,
  Sparkles,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Vigilance — Watch your money. Or watch it drift.",
  description:
    "A 30-second daily ritual against financial drift. Multi-account check-in, CFO-grade hints, weekly reckoning, monthly close.",
};

export default async function LandingPage() {
  // Authed users never see marketing — straight to the app.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app");

  return (
    <main className="min-h-screen bg-bg-primary text-text-primary">
      {/* Top nav */}
      <nav className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-6 md:px-12 md:py-8">
        <div className="text-[11px] font-medium tracking-[0.28em] text-accent-primary">
          VIGILANCE
        </div>
        <Link
          href="/login"
          className="text-sm text-text-secondary transition hover:text-text-primary"
        >
          Sign in
        </Link>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1100px] px-6 pb-24 pt-12 md:px-12 md:pb-32 md:pt-24">
        <div className="mx-auto max-w-[820px] text-center">
          <h1 className="font-ledger text-[44px] leading-[1.05] tracking-tight md:text-[80px]">
            Watch your money.
            <br />
            <span className="text-text-secondary">Or watch it drift.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-[460px] text-base leading-relaxed text-text-secondary md:mt-9 md:text-lg">
            A 30-second daily ritual against financial drift.
          </p>
          <div className="mt-10 flex justify-center md:mt-12">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-hero bg-accent-primary px-7 py-4 text-sm font-medium text-bg-primary transition hover:opacity-90"
            >
              Get started
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* Hero visual: phone-frame stack of swipe cards */}
        <div className="mx-auto mt-20 max-w-[380px] md:mt-28">
          <div className="relative">
            {/* Back card (peeking) */}
            <div className="absolute left-3 top-3 h-full w-full -rotate-2 rounded-frame border border-white/5 bg-bg-tertiary/70" />
            <div className="absolute -left-3 top-1.5 h-full w-full rotate-1 rounded-frame border border-white/5 bg-bg-secondary/70" />
            {/* Front card */}
            <div className="relative rounded-frame border border-white/10 bg-bg-secondary p-6 shadow-[0_0_80px_rgba(212,175,55,0.06)]">
              <div className="mb-5 flex items-center justify-between">
                <div className="text-[9px] tracking-[0.2em] text-text-secondary">
                  CHECKING IN
                </div>
                <div className="text-[9px] tabular-nums text-text-muted">
                  3 of 8
                </div>
              </div>
              <div className="rounded-hero border border-accent-primary/30 bg-bg-tertiary p-5">
                <div className="text-xs text-text-secondary">Mercury</div>
                <div className="mt-1 font-ledger text-[32px] leading-none tabular-nums text-text-primary">
                  $42,180
                </div>
                <div className="mt-3 inline-flex items-center gap-1 text-xs text-positive">
                  <ArrowUpRight className="h-3 w-3" />
                  +$1,200 today
                </div>
              </div>
              <div className="mt-5 text-center text-[10px] tracking-[0.18em] text-text-muted">
                SWIPE RIGHT TO ACKNOWLEDGE
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1100px] px-6 py-24 md:px-12 md:py-32">
        <div className="mx-auto max-w-[640px]">
          <div className="text-[10px] tracking-[0.3em] text-accent-primary">
            HOW IT WORKS
          </div>
          <h2 className="mt-3 font-ledger text-[36px] leading-tight md:text-[56px]">
            Three steps. Built to last.
          </h2>
        </div>

        <div className="mx-auto mt-20 max-w-[1100px] space-y-28 md:space-y-36">
          <Step
            num="01"
            title="Add your accounts"
            body="Bank, credit cards, investments, crypto, loans. Connect via Plaid or add manually. Multi-currency supported — USD, CAD, EUR, PYG."
            visual={<MockAddAccount />}
            reverse={false}
          />
          <Step
            num="02"
            title="Check in daily, 30 seconds"
            body="One card per account. Swipe right to acknowledge, up to flag. Your awareness streak builds. The ritual is the product."
            visual={<MockSwipe />}
            reverse
          />
          <Step
            num="03"
            title="Catch what experts catch"
            body="Mortgage windows. Debt math. Credit utilization. Tax residency days. Surfaced when it matters, not after."
            visual={<MockHints />}
            reverse={false}
          />
        </div>
      </section>

      {/* ── EXPERT HINTS ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1100px] px-6 py-24 md:px-12 md:py-32">
        <div className="mx-auto max-w-[700px]">
          <div className="text-[10px] tracking-[0.3em] text-accent-primary">
            THE MOAT
          </div>
          <h2 className="mt-3 font-ledger text-[36px] leading-tight md:text-[56px]">
            What financial experts see.
            <br />
            <span className="text-text-secondary">Surfaced for you.</span>
          </h2>
          <p className="mt-6 max-w-[560px] text-base leading-relaxed text-text-secondary md:text-lg">
            95% of people don&apos;t have a CFO. Vigilance is that lens —
            templated rules + Claude composing the explanation in plain English.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-[1100px] gap-4 md:mt-20 md:grid-cols-3">
          <HintExample category="pay_attention" id="H-001">
            Your car loan at{" "}
            <span className="text-accent-primary tabular-nums">6.49%</span> is
            your worst-weighted debt. Paying it off ={" "}
            <span className="text-accent-primary tabular-nums">~6.49%</span>{" "}
            guaranteed return vs Duvelt&apos;s{" "}
            <span className="text-accent-primary tabular-nums">9.6%</span>{" "}
            market risk.{" "}
            <span className="text-accent-primary">
              Pay this before adding to investments.
            </span>
          </HintExample>
          <HintExample category="pay_attention" id="H-002">
            Visa hits{" "}
            <span className="text-accent-primary tabular-nums">78%</span>{" "}
            utilization in{" "}
            <span className="text-accent-primary tabular-nums">4</span> days at
            statement close. Pay{" "}
            <span className="text-accent-primary tabular-nums">$2,400</span> by
            Tuesday to keep under 30% — preserves credit score for upcoming
            credit needs.
          </HintExample>
          <HintExample category="opportunity" id="H-101">
            Bank of Canada cut{" "}
            <span className="text-accent-primary tabular-nums">25bps</span>.
            Your mortgage renews in{" "}
            <span className="text-accent-primary tabular-nums">14</span> months
            at{" "}
            <span className="text-accent-primary tabular-nums">5.49%</span>.
            Major banks now offer{" "}
            <span className="text-accent-primary tabular-nums">4.79%</span>{" "}
            3-year fixed. Start shopping now — could save{" "}
            <span className="text-accent-primary tabular-nums">
              ~$8,200/yr
            </span>
            .
          </HintExample>
        </div>
      </section>

      {/* ── THE RITUALS ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1100px] px-6 py-24 md:px-12 md:py-32">
        <div className="mx-auto max-w-[700px]">
          <div className="text-[10px] tracking-[0.3em] text-accent-primary">
            THE RITUALS
          </div>
          <h2 className="mt-3 font-ledger text-[36px] leading-tight md:text-[56px]">
            Most people review yearly.
            <br />
            <span className="text-text-secondary">
              You review every 30 days.
            </span>
          </h2>

          <div className="mt-14 grid gap-12 md:grid-cols-2 md:gap-16">
            <div>
              <div className="text-[10px] tracking-[0.3em] text-accent-primary">
                SUNDAY RECKONING
              </div>
              <div className="mt-3 font-ledger text-2xl text-text-primary">
                10 minutes, every Sunday.
              </div>
              <p className="mt-4 text-base leading-relaxed text-text-secondary">
                Net worth chart. Biggest movers. Payments incoming. One
                reflection prompt. Daily swiping prevents drift, weekly
                reckoning prevents strategic blindness.
              </p>
            </div>
            <div>
              <div className="text-[10px] tracking-[0.3em] text-accent-primary">
                MONTHLY CLOSE
              </div>
              <div className="mt-3 font-ledger text-2xl text-text-primary">
                20 minutes, last day of the month.
              </div>
              <p className="mt-4 text-base leading-relaxed text-text-secondary">
                Full waterfall. Wins. Drags. The annual report for yourself,
                every 30 days. Over a decade, that&apos;s the difference
                between coasting and compounding.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1100px] px-6 py-24 md:px-12 md:py-32">
        <div className="mx-auto max-w-[700px]">
          <div className="text-[10px] tracking-[0.3em] text-accent-primary">
            TRUST
          </div>
          <h2 className="mt-3 font-ledger text-[36px] leading-tight md:text-[56px]">
            Your data. Your control.
          </h2>

          <div className="mt-12 space-y-7 text-base leading-relaxed text-text-secondary md:text-lg">
            <p>
              Bank connections via Plaid. Read-only. Account numbers and
              credentials never touch our servers.
            </p>
            <p>
              Your financial data lives in a Supabase project we provision for
              you. You control the keys. Export, delete, or move it at any
              time.
            </p>
            <p>
              We&apos;re new. No fake user counts, no logo carousels. Vigilance
              is a tool we built for ourselves first.
            </p>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1100px] px-6 py-24 text-center md:px-12 md:py-32">
        <Flame className="mx-auto h-6 w-6 text-accent-primary" />
        <h2 className="mt-6 font-ledger text-[36px] leading-tight md:text-[56px]">
          Start your awareness streak.
        </h2>
        <div className="mt-10 flex justify-center md:mt-12">
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 rounded-hero bg-accent-primary px-7 py-4 text-sm font-medium text-bg-primary transition hover:opacity-90"
          >
            Get started
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-[1100px] flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center md:gap-12 md:px-12">
          <div className="text-[11px] tracking-[0.28em] text-accent-primary">
            VIGILANCE
          </div>
          <div className="flex flex-col gap-3 text-sm text-text-secondary md:flex-row md:items-center md:gap-8">
            <a
              href="mailto:coo@revarity.com"
              className="transition hover:text-text-primary"
            >
              coo@revarity.com
            </a>
            <Link
              href="/privacy"
              className="transition hover:text-text-primary"
            >
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-text-primary">
              Terms
            </Link>
            <span className="text-text-muted">Built by Revarity</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

// ─── Step (numbered row with visual) ─────────────────────────────
function Step({
  num,
  title,
  body,
  visual,
  reverse,
}: {
  num: string;
  title: string;
  body: string;
  visual: React.ReactNode;
  reverse: boolean;
}) {
  return (
    <div className="grid items-center gap-12 md:grid-cols-2 md:gap-20">
      <div className={reverse ? "md:order-2" : ""}>
        <div className="font-ledger text-[64px] leading-none text-accent-primary/30 tabular-nums md:text-[88px]">
          {num}
        </div>
        <h3 className="mt-4 font-ledger text-[28px] leading-tight md:text-[40px]">
          {title}
        </h3>
        <p className="mt-5 max-w-[460px] text-base leading-relaxed text-text-secondary md:text-lg">
          {body}
        </p>
      </div>
      <div className={reverse ? "md:order-1" : ""}>{visual}</div>
    </div>
  );
}

// ─── Hint card (matches the in-app HintCard design) ──────────────
function HintExample({
  category,
  id,
  children,
}: {
  category: "pay_attention" | "opportunity" | "strategic";
  id: string;
  children: React.ReactNode;
}) {
  const styles = {
    pay_attention: {
      border: "border-l-hint-pay-attention",
      label: "text-hint-pay-attention",
      icon: AlertTriangle,
      labelText: "PAY ATTENTION",
    },
    opportunity: {
      border: "border-l-hint-opportunity",
      label: "text-hint-opportunity",
      icon: Sparkles,
      labelText: "OPPORTUNITY",
    },
    strategic: {
      border: "border-l-hint-strategic",
      label: "text-hint-strategic",
      icon: Sparkles,
      labelText: "STRATEGIC",
    },
  }[category];
  const Icon = styles.icon;
  return (
    <div
      className={`rounded-card border border-white/5 border-l-2 ${styles.border} bg-bg-secondary p-5 transition hover:bg-bg-tertiary`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3 w-3 ${styles.label}`} />
          <span
            className={`text-[10px] tracking-[0.2em] ${styles.label}`}
          >
            {styles.labelText}
          </span>
        </div>
        <span className="text-[9px] tabular-nums text-text-muted">{id}</span>
      </div>
      <div className="text-sm leading-relaxed text-text-primary">
        {children}
      </div>
    </div>
  );
}

// ─── Step visuals (gold-on-dark product mockups) ─────────────────
function MockAddAccount() {
  return (
    <div className="rounded-frame border border-white/10 bg-bg-secondary p-6 shadow-[0_0_60px_rgba(212,175,55,0.04)]">
      <div className="mb-6 text-[9px] tracking-[0.2em] text-text-secondary">
        NEW ACCOUNT
      </div>
      <div className="font-ledger text-2xl text-text-primary">Add account</div>
      <div className="mt-6 space-y-3.5">
        {[
          { label: "TYPE", value: "Bank account" },
          { label: "NAME", value: "Scotiabank" },
          { label: "SUBTITLE", value: "Business · Chequing" },
        ].map((row) => (
          <div key={row.label}>
            <div className="text-[9px] tracking-[0.15em] text-text-secondary">
              {row.label}
            </div>
            <div className="mt-1 rounded-md border border-input bg-bg-tertiary px-3 py-2 text-sm text-text-primary">
              {row.value}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <div className="text-[9px] tracking-[0.15em] text-text-secondary">
              BALANCE
            </div>
            <div className="mt-1 rounded-md border border-input bg-bg-tertiary px-3 py-2 text-sm tabular-nums text-text-primary">
              28,400.00
            </div>
          </div>
          <div>
            <div className="text-[9px] tracking-[0.15em] text-text-secondary">
              CCY
            </div>
            <div className="mt-1 rounded-md border border-input bg-bg-tertiary px-3 py-2 text-sm text-text-primary">
              CAD
            </div>
          </div>
        </div>
        <div className="mt-2 rounded-md bg-accent-primary py-2.5 text-center text-sm font-medium text-bg-primary">
          Add account
        </div>
      </div>
    </div>
  );
}

function MockSwipe() {
  return (
    <div className="relative mx-auto max-w-[360px]">
      {/* Stacked cards */}
      <div className="absolute -left-3 top-2 h-full w-full rotate-2 rounded-frame border border-white/5 bg-bg-tertiary/60" />
      <div className="absolute left-2 top-3 h-full w-full -rotate-1 rounded-frame border border-white/5 bg-bg-secondary/70" />
      <div className="relative rounded-frame border border-white/10 bg-bg-secondary p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="text-[9px] tracking-[0.2em] text-text-secondary">
            ACCOUNT 5 / 8
          </div>
          <div className="text-[9px] tabular-nums text-positive">47🔥</div>
        </div>
        <div className="rounded-hero border border-accent-primary/30 bg-bg-tertiary p-5">
          <div className="text-xs text-text-secondary">Scotiabank</div>
          <div className="mt-1 font-ledger text-[28px] leading-none tabular-nums">
            C$28,400
          </div>
          <div className="mt-3 inline-flex items-center gap-1 text-xs text-positive">
            <ArrowUpRight className="h-3 w-3" />
            +$1,840 since yesterday
          </div>
        </div>
        <div className="mt-5 flex items-center justify-center gap-6 text-[10px] uppercase tracking-[0.18em]">
          <span className="text-text-muted">↑ flag</span>
          <span className="text-accent-primary">→ acknowledge</span>
        </div>
      </div>
    </div>
  );
}

function MockHints() {
  return (
    <div className="space-y-3">
      <div className="rounded-card border border-white/5 border-l-2 border-l-hint-pay-attention bg-bg-secondary p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-hint-pay-attention" />
          <span className="text-[9px] tracking-[0.2em] text-hint-pay-attention">
            PAY ATTENTION
          </span>
        </div>
        <div className="text-xs leading-relaxed text-text-primary">
          Visa hits{" "}
          <span className="text-accent-primary tabular-nums">78%</span>{" "}
          utilization in 4 days. Pay{" "}
          <span className="text-accent-primary tabular-nums">$2,400</span> by
          Tuesday.
        </div>
      </div>
      <div className="rounded-card border border-white/5 border-l-2 border-l-hint-opportunity bg-bg-secondary p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-accent-primary" />
          <span className="text-[9px] tracking-[0.2em] text-accent-primary">
            OPPORTUNITY
          </span>
        </div>
        <div className="text-xs leading-relaxed text-text-primary">
          <span className="text-accent-primary tabular-nums">$48K</span>{" "}
          earning 0.4% in TD checking. EQ Bank HISA at{" "}
          <span className="text-accent-primary tabular-nums">4.25%</span> ={" "}
          <span className="text-accent-primary tabular-nums">~$1,840/yr</span>{" "}
          extra.
        </div>
      </div>
      <div className="rounded-card border border-white/5 border-l-2 border-l-hint-strategic bg-bg-secondary p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-hint-strategic" />
          <span className="text-[9px] tracking-[0.2em] text-hint-strategic">
            STRATEGIC
          </span>
        </div>
        <div className="text-xs leading-relaxed text-text-primary">
          Cash position{" "}
          <span className="text-accent-primary tabular-nums">31%</span> of net
          worth. STR-operator benchmark:{" "}
          <span className="text-accent-primary tabular-nums">15–20%</span>.
          Over-reserving.
        </div>
      </div>
    </div>
  );
}
