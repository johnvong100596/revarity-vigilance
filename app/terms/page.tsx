import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms · Vigilance",
  description:
    "The plain-English agreement between you and Vigilance — what's promised, what's not.",
};

const LAST_UPDATED = "May 26, 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-[760px] px-6 pb-24 pt-10 md:px-10 md:pt-16">
      <header className="mb-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </header>

      <h1 className="text-balance text-[40px] font-bold leading-[1.05] tracking-[-0.025em] text-text-primary md:text-[56px]">
        Terms
      </h1>
      <p className="mt-3 text-sm text-text-muted">Last updated {LAST_UPDATED}</p>

      <div className="prose-vigilance mt-12 space-y-10 text-[15px] leading-relaxed text-text-secondary md:text-[16px]">
        <Section title="The deal">
          <p>
            Vigilance is a personal-finance check-in tool operated by
            Revarity. By signing in you agree to these terms.
          </p>
          <p>
            We try to make this short and readable. The lawyer version is
            implicit — these terms aim to cover the same ground without
            making you wade through it.
          </p>
        </Section>

        <Section title="What Vigilance is">
          <p>
            A daily ritual app: you check in on your accounts, we surface
            insights, you make better financial decisions over time. We
            connect to your banks via Plaid to keep balances current. We
            don&apos;t move money, we don&apos;t pay bills, we don&apos;t
            trade investments. We&apos;re a mirror, not a hand.
          </p>
        </Section>

        <Section title="What Vigilance is not">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="font-semibold text-text-primary">
                Not financial advice.
              </strong>{" "}
              The hints we surface (debt prioritization, credit utilization,
              mortgage windows, etc.) are general patterns experts notice —
              they aren&apos;t personal advice. For decisions with real
              stakes, talk to a licensed professional.
            </li>
            <li>
              <strong className="font-semibold text-text-primary">
                Not tax advice.
              </strong>{" "}
              Same.
            </li>
            <li>
              <strong className="font-semibold text-text-primary">
                Not legal advice.
              </strong>{" "}
              Same.
            </li>
            <li>
              <strong className="font-semibold text-text-primary">
                Not a bank or a payment processor.
              </strong>{" "}
              We hold no money and offer no banking services.
            </li>
            <li>
              <strong className="font-semibold text-text-primary">
                Not insured.
              </strong>{" "}
              We don&apos;t hold deposits.
            </li>
          </ul>
        </Section>

        <Section title="Your responsibilities">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Provide accurate information when you connect accounts (Plaid
              handles your bank login).
            </li>
            <li>
              Don&apos;t share your sign-in magic link — anyone with the link
              can access your account during its 1-hour window.
            </li>
            <li>
              Use Vigilance for personal financial reflection, not to mine
              data, attack our infrastructure, or build a competing service
              on our copy and design.
            </li>
          </ul>
        </Section>

        <Section title="What we promise">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              We&apos;ll keep your data private (see{" "}
              <Link
                href="/privacy"
                className="text-accent-primary underline-offset-4 hover:underline"
              >
                Privacy
              </Link>
              ).
            </li>
            <li>
              We&apos;ll try hard to keep Vigilance running. We&apos;ll fix
              bugs as we find them.
            </li>
            <li>
              We&apos;ll tell you before we change something that affects
              you (data handling, pricing, features being removed).
            </li>
          </ul>
        </Section>

        <Section title="What we don't promise">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              That Vigilance will be available 24/7 forever — we run on
              third-party infrastructure (Supabase, Vercel, Plaid) that has
              its own uptime.
            </li>
            <li>
              That every hint will be right. The expert rules cover common
              patterns, not every situation. Use judgment.
            </li>
            <li>
              That balances will always match your bank to the cent. Plaid
              syncs on a delay; we surface the latest data we have. For
              high-stakes decisions, check your bank directly.
            </li>
          </ul>
        </Section>

        <Section title="Liability">
          <p>
            Vigilance is provided &ldquo;as is.&rdquo; To the maximum extent
            allowed by law, Revarity is not liable for any losses, missed
            opportunities, or financial decisions you make based on what you
            see in the app. Use Vigilance as one input among many, not the
            only one.
          </p>
        </Section>

        <Section title="Closing your account">
          <p>
            You can disconnect banks and archive accounts anytime from
            Settings. To fully delete everything, email{" "}
            <a
              href="mailto:coo@revarity.com"
              className="text-accent-primary underline-offset-4 hover:underline"
            >
              coo@revarity.com
            </a>{" "}
            and we&apos;ll hard-delete within 14 days.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            If we change these terms, we&apos;ll email you. If you keep
            using Vigilance after the change takes effect, you accept the
            new version. If you don&apos;t agree, close your account.
          </p>
        </Section>

        <Section title="Governing law">
          <p>
            These terms are governed by the laws of Ontario, Canada. Disputes
            we can&apos;t resolve directly go to the courts of Toronto.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions:{" "}
            <a
              href="mailto:coo@revarity.com"
              className="text-accent-primary underline-offset-4 hover:underline"
            >
              coo@revarity.com
            </a>
            . Vigilance is operated by Revarity.
          </p>
        </Section>
      </div>

      <footer className="mt-16 border-t border-text-primary/10 pt-8">
        <Link
          href="/privacy"
          className="text-sm font-medium text-accent-primary underline-offset-4 hover:underline"
        >
          Read Privacy →
        </Link>
      </footer>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold tracking-[-0.015em] text-text-primary md:text-2xl">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
