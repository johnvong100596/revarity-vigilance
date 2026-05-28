import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Eye,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { AnimatedSection } from "@/components/marketing/AnimatedSection";
import { HeroOrb } from "@/components/marketing/HeroOrb";
import { ParallaxBlock } from "@/components/marketing/ParallaxBlock";
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
    <main className="relative min-h-screen overflow-hidden bg-bg-primary text-text-primary">
      {/* Decorative scroll-linked gradient orbs (behind content, pointer-events:none) */}
      <HeroOrb
        className="left-1/2 top-[18vh] -translate-x-1/2"
        size={720}
        intensity={0.16}
      />
      <HeroOrb
        className="left-[10%] top-[55vh]"
        size={520}
        intensity={0.1}
        driftY={-180}
        driftX={80}
      />
      <HeroOrb
        className="right-[5%] top-[90vh]"
        size={600}
        intensity={0.12}
        driftY={250}
        driftX={-100}
      />

      {/* ─── NAV ─── */}
      <nav className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5 md:px-10 md:py-7">
        <div className="text-xl font-semibold tracking-tight">Vigilance</div>
        <div className="flex items-center gap-2 md:gap-5">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-text-primary transition hover:text-accent-primary sm:inline"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-full bg-accent-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative mx-auto max-w-[1200px] px-6 pb-24 pt-16 md:px-10 md:pb-40 md:pt-28">
        <div className="mx-auto max-w-[1000px] text-center">
          <h1 className="font-fraunces text-balance text-[52px] font-semibold leading-[0.95] tracking-[-0.04em] text-text-primary md:text-[112px]">
            Money, finally clear.
          </h1>
          <p className="mx-auto mt-8 max-w-[540px] text-base leading-relaxed text-text-secondary md:mt-10 md:text-xl">
            Every account, totaled. Updated daily. In plain English.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 md:mt-12 md:flex-row md:gap-4">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-full bg-accent-primary px-8 py-4 text-base font-semibold text-white transition hover:opacity-90"
            >
              See yours in 60 seconds
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center px-4 py-3 text-sm font-medium text-text-primary underline-offset-4 hover:underline sm:hidden"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Hero visual — phone-frame swipe stack with scroll parallax */}
        <ParallaxBlock className="mx-auto mt-20 max-w-[420px] md:mt-28" amount={-50}>
          <HeroMockup />
        </ParallaxBlock>
      </section>

      {/* ─── TRUST STRIP ─── */}
      <AnimatedSection className="relative border-y border-text-primary/10 bg-bg-tertiary">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-y-8 px-6 py-10 sm:grid-cols-3 md:px-10 md:py-14">
          <Stat top="30 seconds" bottom="daily check-in" />
          <Stat top="4 currencies" bottom="USD · CAD · EUR · PYG" />
          <Stat top="6 expert lenses" bottom="growing weekly" />
        </div>
      </AnimatedSection>

      {/* ─── WHY VIGILANCE (3-column differentiation) ─── */}
      <AnimatedSection className="relative mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-32">
        <div className="mx-auto max-w-[720px] text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-primary">
            Stop guessing
          </div>
          <h2 className="mt-4 font-fraunces text-balance text-[40px] font-semibold leading-[1.05] tracking-[-0.025em] md:text-[56px]">
            You don&apos;t need another budgeting app.
          </h2>
        </div>
        <div className="mx-auto mt-16 grid max-w-[1000px] grid-cols-1 gap-4 md:grid-cols-3">
          <CompareColumn
            title="What you're doing now"
            tone="muted"
            items={[
              "Check 4–7 bank apps every week",
              "Mental math in your head",
              "Don't actually know your net worth",
              "A spreadsheet that's always out of date",
            ]}
          />
          <CompareColumn
            title="What other apps want"
            tone="muted"
            items={[
              "Categorize every transaction",
              "Build a budget with envelopes",
              "Track every single dollar",
              "Become a finance person",
            ]}
          />
          <CompareColumn
            title="What Vigilance does"
            tone="accent"
            items={[
              "Your real net worth, in one number",
              "A 30-second daily check-in",
              "A heads-up when something needs your eyes",
              "You don't have to change who you are",
            ]}
          />
        </div>
      </AnimatedSection>

      {/* ─── HOW IT WORKS ─── */}
      <AnimatedSection className="relative mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-40">
        <div className="mx-auto max-w-[720px] text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-primary">
            How it works
          </div>
          <h2 className="mt-4 font-fraunces text-balance text-[40px] font-semibold leading-[1.05] tracking-[-0.025em] md:text-[64px]">
            Three steps. Built to last.
          </h2>
        </div>

        <div className="mx-auto mt-20 max-w-[1100px] space-y-28 md:space-y-40">
          <Step
            num="01"
            title="Connect your banks"
            body="Bank accounts, credit cards, mortgages, investments. Vigilance pulls balances automatically through Plaid (the bank-connection service trusted by 12,000+ banks). Read-only, sign-in details never touch our servers."
            visual={<MockAddAccount />}
            reverse={false}
          />
          <Step
            num="02"
            title="Check in daily, 30 seconds"
            body="One card per account. Swipe right when it looks good, up when something needs another look. Your awareness streak builds. The ritual is the product."
            visual={<MockSwipe />}
            reverse
          />
          <Step
            num="03"
            title="Catch what experts catch"
            body="Worst-cost debt. Credit utilization near bill close. Mortgage renewal windows. Tax residency days. Surfaced when it matters, not after."
            visual={<MockHints />}
            reverse={false}
          />
        </div>
      </AnimatedSection>

      {/* ─── EDITORIAL QUOTE ─── */}
      <AnimatedSection className="relative bg-bg-tertiary">
        <div className="mx-auto max-w-[1000px] px-6 py-28 text-center md:px-10 md:py-40">
          <p className="font-fraunces text-balance text-[32px] font-medium leading-[1.15] tracking-[-0.02em] text-text-primary md:text-[56px]">
            “Finance is like your widow.
            <br />
            <span className="text-accent-primary">Ignore her, and she comes back to bite you.</span>”
          </p>
          <div className="mt-8 text-sm uppercase tracking-[0.18em] text-text-muted">
            The thesis
          </div>
        </div>
      </AnimatedSection>

      {/* ─── EXPERT HINTS ─── */}
      <AnimatedSection className="relative mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-40">
        <div className="mx-auto max-w-[720px]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-primary">
            The moat
          </div>
          <h2 className="mt-4 font-fraunces text-balance text-[40px] font-semibold leading-[1.05] tracking-[-0.025em] md:text-[64px]">
            What financial experts see.
            <br />
            <span className="text-text-secondary">Surfaced for you.</span>
          </h2>
          <p className="mt-6 max-w-[560px] text-base leading-relaxed text-text-secondary md:text-lg">
            Most people don&apos;t have a CFO. Vigilance is that lens —
            templated rules plus Claude composing the explanation in plain
            English.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-[1100px] gap-4 md:mt-20 md:grid-cols-3">
          <HintExample category="pay_attention" id="H-001">
            Your car loan at{" "}
            <span className="font-semibold text-accent-primary tabular-nums">
              6.49%
            </span>{" "}
            is your worst-weighted debt. Paying it off ={" "}
            <span className="font-semibold text-accent-primary tabular-nums">
              ~6.49%
            </span>{" "}
            guaranteed return vs Duvelt&apos;s{" "}
            <span className="font-semibold text-accent-primary tabular-nums">
              9.6%
            </span>{" "}
            market risk.{" "}
            <span className="text-accent-primary">
              Pay this before adding to investments.
            </span>
          </HintExample>
          <HintExample category="pay_attention" id="H-002">
            Your Visa is{" "}
            <span className="font-semibold text-accent-primary tabular-nums">
              78%
            </span>{" "}
            full and the bill cuts in{" "}
            <span className="font-semibold text-accent-primary tabular-nums">
              4
            </span>{" "}
            days. Paying{" "}
            <span className="font-semibold text-accent-primary tabular-nums">
              $2,400
            </span>{" "}
            by Tuesday keeps you under 30% — which protects your credit score.
          </HintExample>
          <HintExample category="opportunity" id="H-101">
            Bank of Canada cut{" "}
            <span className="font-semibold text-accent-primary tabular-nums">
              25bps
            </span>
            . Your mortgage renews in{" "}
            <span className="font-semibold text-accent-primary tabular-nums">
              14
            </span>{" "}
            months at{" "}
            <span className="font-semibold text-accent-primary tabular-nums">
              5.49%
            </span>
            . Major banks now offer{" "}
            <span className="font-semibold text-accent-primary tabular-nums">
              4.79%
            </span>{" "}
            3-year fixed. Start shopping — could save{" "}
            <span className="font-semibold text-accent-primary tabular-nums">
              ~$8,200/yr
            </span>
            .
          </HintExample>
        </div>
      </AnimatedSection>

      {/* ─── RITUALS ─── */}
      <AnimatedSection className="relative bg-bg-tertiary">
        <div className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-40">
          <div className="mx-auto max-w-[800px]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-primary">
              The rituals
            </div>
            <h2 className="mt-4 font-fraunces text-balance text-[40px] font-semibold leading-[1.05] tracking-[-0.025em] md:text-[64px]">
              Most people review yearly.
              <br />
              <span className="text-text-secondary">
                You review every 30 days.
              </span>
            </h2>
          </div>

          <div className="mx-auto mt-16 grid max-w-[1100px] gap-12 md:mt-20 md:grid-cols-2 md:gap-20">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                Sunday Reckoning
              </div>
              <div className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.02em] md:text-4xl">
                10 minutes, every Sunday.
              </div>
              <p className="mt-5 text-base leading-relaxed text-text-secondary md:text-lg">
                Net worth chart. Biggest movers. Payments incoming. One
                reflection prompt. Daily swiping prevents drift, weekly
                reckoning prevents strategic blindness.
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                Monthly Close
              </div>
              <div className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.02em] md:text-4xl">
                20 minutes, last day of the month.
              </div>
              <p className="mt-5 text-base leading-relaxed text-text-secondary md:text-lg">
                Full waterfall. Wins. Drags. The annual report for yourself,
                every 30 days. Over a decade, that&apos;s the difference
                between coasting and compounding.
              </p>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* ─── TRUST ─── */}
      <AnimatedSection className="relative mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-40">
        <div className="mx-auto max-w-[760px]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-primary">
            Trust
          </div>
          <h2 className="mt-4 font-fraunces text-balance text-[40px] font-semibold leading-[1.05] tracking-[-0.025em] md:text-[64px]">
            Your data. Your control.
          </h2>

          <div className="mt-12 space-y-7 text-base leading-relaxed text-text-secondary md:text-lg">
            <p>
              Bank connections via Plaid. Read-only. Account numbers and
              credentials never touch our servers.
            </p>
            <p>
              Your financial data is row-isolated in our database — your
              account, your data, your view. Export, delete, or take it
              elsewhere at any time.
            </p>
            <p>
              We&apos;re new. No fake user counts, no logo carousels. Vigilance
              is a tool we built for ourselves first.
            </p>
          </div>
        </div>
      </AnimatedSection>

      {/* ─── FINAL CTA ─── */}
      <AnimatedSection className="relative bg-bg-tertiary">
        <div className="mx-auto max-w-[1000px] px-6 py-24 text-center md:px-10 md:py-40">
          <h2 className="font-fraunces text-balance text-[40px] font-semibold leading-[1.05] tracking-[-0.025em] md:text-[72px]">
            Start your awareness streak.
          </h2>
          <p className="mx-auto mt-6 max-w-[440px] text-base leading-relaxed text-text-secondary md:text-lg">
            30 seconds a day. Forever.
          </p>
          <div className="mt-10 flex justify-center md:mt-12">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-full bg-accent-primary px-8 py-4 text-base font-semibold text-white transition hover:opacity-90"
            >
              See yours in 60 seconds
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-accent-primary" />
              Plaid-secured
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-accent-primary" />
              Encrypted at rest
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-accent-primary" />
              Read-only. We never move your money.
            </span>
          </div>
        </div>
      </AnimatedSection>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-text-primary/10">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center md:gap-12 md:px-10">
          <div className="text-base font-semibold tracking-tight">
            Vigilance
          </div>
          <div className="flex flex-col gap-3 text-sm text-text-secondary md:flex-row md:items-center md:gap-8">
            <Link
              href="/login"
              className="transition hover:text-text-primary"
            >
              Sign in
            </Link>
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
            <span className="text-text-muted">
              Built by{" "}
              <a
                href="https://revarity.com"
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-text-primary"
              >
                Revarity LLC
              </a>
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}

// ─── Stat row (trust strip) ──────────────────────────────────────
function Stat({ top, bottom }: { top: string; bottom: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold tracking-[-0.02em] tabular-nums md:text-4xl">
        {top}
      </div>
      <div className="mt-2 text-sm text-text-secondary">{bottom}</div>
    </div>
  );
}

// ─── Why-Vigilance comparison column ─────────────────────────────
function CompareColumn({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "muted" | "accent";
}) {
  const isAccent = tone === "accent";
  return (
    <div
      className={`rounded-card border p-6 ${
        isAccent
          ? "border-accent-primary/30 bg-accent-soft"
          : "border-text-primary/8 bg-bg-tertiary"
      }`}
    >
      <div
        className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
          isAccent ? "text-accent-primary" : "text-text-muted"
        }`}
      >
        {title}
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className={`flex items-start gap-2 text-sm leading-snug ${
              isAccent ? "text-text-primary" : "text-text-secondary"
            }`}
          >
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                isAccent ? "bg-accent-primary" : "bg-text-primary/20"
              }`}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Numbered step row ───────────────────────────────────────────
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
        <div className="text-7xl font-bold tabular-nums tracking-[-0.04em] text-accent-primary md:text-[120px]">
          {num}
        </div>
        <h3 className="mt-6 font-fraunces text-balance text-[32px] font-semibold leading-tight tracking-[-0.025em] md:text-[48px]">
          {title}
        </h3>
        <p className="mt-5 max-w-[480px] text-base leading-relaxed text-text-secondary md:text-lg">
          {body}
        </p>
      </div>
      <div className={reverse ? "md:order-1" : ""}>{visual}</div>
    </div>
  );
}

// ─── Expert hint card (matches in-app HintCard) ──────────────────
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
      labelText: "Pay attention",
    },
    opportunity: {
      border: "border-l-hint-opportunity",
      label: "text-hint-opportunity",
      icon: Sparkles,
      labelText: "Opportunity",
    },
    strategic: {
      border: "border-l-hint-strategic",
      label: "text-hint-strategic",
      icon: Sparkles,
      labelText: "Strategic",
    },
  }[category];
  const Icon = styles.icon;
  return (
    <div
      className={`rounded-card border border-text-primary/10 border-l-[3px] ${styles.border} bg-bg-tertiary p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${styles.label}`} />
          <span
            className={`text-xs font-semibold uppercase tracking-[0.14em] ${styles.label}`}
          >
            {styles.labelText}
          </span>
        </div>
        <span className="text-[10px] font-medium tabular-nums text-text-muted">
          {id}
        </span>
      </div>
      <div className="text-[15px] leading-relaxed text-text-primary">
        {children}
      </div>
    </div>
  );
}

// ─── Phone-frame hero mockup ─────────────────────────────────────
function HeroMockup() {
  return (
    <div className="relative">
      <div className="absolute -left-3 top-3 h-full w-full -rotate-3 rounded-frame bg-bg-secondary/60" />
      <div className="absolute left-3 top-1.5 h-full w-full rotate-2 rounded-frame bg-bg-secondary/80" />
      <div className="relative rounded-frame border border-text-primary/8 bg-bg-tertiary p-6 shadow-[0_30px_80px_rgba(26,26,26,0.08),0_4px_16px_rgba(26,26,26,0.04)]">
        <div className="mb-5 flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Checking in
          </div>
          <div className="text-[10px] font-medium tabular-nums text-text-muted">
            3 of 8
          </div>
        </div>
        <div className="rounded-hero border border-text-primary/8 bg-bg-primary p-5">
          <div className="text-xs text-text-secondary">Mercury</div>
          <div className="mt-1 text-[36px] font-bold leading-none tracking-[-0.025em] tabular-nums text-text-primary">
            $42,180
          </div>
          <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-positive">
            <ArrowUpRight className="h-3 w-3" />
            +$1,200 today
          </div>
        </div>
        <div className="mt-5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Swipe right to acknowledge
        </div>
      </div>
    </div>
  );
}

// ─── Step visuals ────────────────────────────────────────────────
function MockAddAccount() {
  return (
    <div className="rounded-frame border border-text-primary/8 bg-bg-tertiary p-6 shadow-[0_20px_60px_rgba(26,26,26,0.06),0_2px_8px_rgba(26,26,26,0.03)]">
      <div className="mb-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        New account
      </div>
      <div className="text-2xl font-bold tracking-[-0.025em]">Add account</div>
      <div className="mt-6 space-y-3.5">
        {[
          { label: "Type", value: "Bank account" },
          { label: "Name", value: "Scotiabank" },
          { label: "Subtitle", value: "Business · Chequing" },
        ].map((row) => (
          <div key={row.label}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
              {row.label}
            </div>
            <div className="mt-1.5 rounded-md border border-text-primary/10 bg-bg-primary px-3 py-2.5 text-sm text-text-primary">
              {row.value}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
              Balance
            </div>
            <div className="mt-1.5 rounded-md border border-text-primary/10 bg-bg-primary px-3 py-2.5 text-sm font-medium tabular-nums text-text-primary">
              28,400.00
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
              CCY
            </div>
            <div className="mt-1.5 rounded-md border border-text-primary/10 bg-bg-primary px-3 py-2.5 text-sm text-text-primary">
              CAD
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-full bg-accent-primary py-3 text-center text-sm font-semibold text-white">
          Add account
        </div>
      </div>
    </div>
  );
}

function MockSwipe() {
  return (
    <div className="relative mx-auto max-w-[400px]">
      <div className="absolute -left-3 top-2 h-full w-full rotate-2 rounded-frame bg-bg-secondary/70" />
      <div className="absolute left-3 top-3 h-full w-full -rotate-1 rounded-frame bg-bg-secondary/80" />
      <div className="relative rounded-frame border border-text-primary/8 bg-bg-tertiary p-6 shadow-[0_20px_60px_rgba(26,26,26,0.06),0_2px_8px_rgba(26,26,26,0.03)]">
        <div className="mb-5 flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Account 5 / 8
          </div>
          <div className="flex items-center gap-1 text-[10px] font-semibold text-positive">
            <span className="tabular-nums">47</span>
            <span>days</span>
          </div>
        </div>
        <div className="rounded-hero border border-text-primary/8 bg-bg-primary p-5">
          <div className="text-xs text-text-secondary">Scotiabank</div>
          <div className="mt-1 text-[32px] font-bold leading-none tracking-[-0.025em] tabular-nums text-text-primary">
            C$28,400
          </div>
          <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-positive">
            <ArrowUpRight className="h-3 w-3" />
            +$1,840 since yesterday
          </div>
        </div>
        <div className="mt-5 flex items-center justify-center gap-6 text-[10px] font-semibold uppercase tracking-[0.18em]">
          <span className="text-text-muted">↑ Flag</span>
          <span className="text-accent-primary">→ Acknowledge</span>
        </div>
      </div>
    </div>
  );
}

function MockHints() {
  return (
    <div className="space-y-3">
      <div className="rounded-card border border-text-primary/10 border-l-[3px] border-l-hint-pay-attention bg-bg-tertiary p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="mb-2 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-hint-pay-attention" />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-hint-pay-attention">
            Pay attention
          </span>
        </div>
        <div className="text-sm leading-relaxed text-text-primary">
          Visa hits{" "}
          <span className="font-semibold text-accent-primary tabular-nums">
            78%
          </span>{" "}
          utilization in 4 days. Pay{" "}
          <span className="font-semibold text-accent-primary tabular-nums">
            $2,400
          </span>{" "}
          by Tuesday.
        </div>
      </div>
      <div className="rounded-card border border-text-primary/10 border-l-[3px] border-l-hint-opportunity bg-bg-tertiary p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent-primary" />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-primary">
            Opportunity
          </span>
        </div>
        <div className="text-sm leading-relaxed text-text-primary">
          <span className="font-semibold text-accent-primary tabular-nums">
            $48K
          </span>{" "}
          earning 0.4% in TD checking. EQ Bank HISA at{" "}
          <span className="font-semibold text-accent-primary tabular-nums">
            4.25%
          </span>{" "}
          ={" "}
          <span className="font-semibold text-accent-primary tabular-nums">
            ~$1,840/yr
          </span>{" "}
          extra.
        </div>
      </div>
      <div className="rounded-card border border-text-primary/10 border-l-[3px] border-l-hint-strategic bg-bg-tertiary p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-hint-strategic" />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-hint-strategic">
            Strategic
          </span>
        </div>
        <div className="text-sm leading-relaxed text-text-primary">
          Cash position{" "}
          <span className="font-semibold text-accent-primary tabular-nums">
            31%
          </span>{" "}
          of net worth. STR-operator benchmark:{" "}
          <span className="font-semibold text-accent-primary tabular-nums">
            15–20%
          </span>
          . Over-reserving.
        </div>
      </div>
    </div>
  );
}
