import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy · Vigilance",
  description:
    "How Vigilance handles your financial data — collected, stored, never sold.",
};

const LAST_UPDATED = "May 26, 2026";

export default function PrivacyPage() {
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
        Privacy
      </h1>
      <p className="mt-3 text-sm text-text-muted">Last updated {LAST_UPDATED}</p>

      <div className="prose-vigilance mt-12 space-y-10 text-[15px] leading-relaxed text-text-secondary md:text-[16px]">
        <Section title="The short version">
          <p>
            Vigilance shows you your own money. We pull balances from your
            banks (with your permission, through Plaid), store them
            row-isolated in our database, and surface insights to help you
            pay attention. We don&apos;t sell, share, or analyze your data
            for anyone but you.
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="font-semibold text-text-primary">
                Your email
              </strong>{" "}
              — to sign you in.
            </li>
            <li>
              <strong className="font-semibold text-text-primary">
                Your bank account data via Plaid
              </strong>{" "}
              — balances, account names, statement dates, interest rates,
              minimum payments. Read-only; we never see your bank
              credentials and we can&apos;t move money.
            </li>
            <li>
              <strong className="font-semibold text-text-primary">
                Your check-ins
              </strong>{" "}
              — which accounts you acknowledged, flagged, or updated, and
              when.
            </li>
            <li>
              <strong className="font-semibold text-text-primary">
                Your reflections
              </strong>{" "}
              — anything you write in the Sunday Reckoning or Monthly Close
              text fields.
            </li>
          </ul>
          <p>
            That&apos;s it. We don&apos;t track you across the web. We
            don&apos;t use marketing or analytics cookies. The only cookie
            we set is the one that keeps you signed in.
          </p>
        </Section>

        <Section title="Where it lives">
          <p>
            Your data lives in a Supabase Postgres database in the US-West
            region. Connection-level access is restricted to the Vigilance
            application. Row-level security policies make sure one
            user&apos;s data can never be returned to another user, even by
            a programming bug.
          </p>
          <p>
            Bank connection credentials (the secret tokens Plaid issues us
            so we can refresh your balances) are encrypted with Supabase
            Vault using pgsodium. Plaintext credentials never persist to
            disk.
          </p>
        </Section>

        <Section title="What we do with it">
          <p>
            Show it back to you. That&apos;s the whole product. We compute
            your net worth, evaluate the six built-in expert rules against
            your data to surface hints, and email you weekly + monthly
            ritual reminders if you have those toggled on.
          </p>
          <p>
            If you ask Vigilance a question through the &ldquo;Ask&rdquo;
            panel, we send the question plus a context summary (your
            account names, balances, and active hints) to Anthropic&apos;s
            Claude API to compose a response. Anthropic does not store or
            train on that data per their{" "}
            <a
              href="https://www.anthropic.com/legal/commercial-terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-primary underline-offset-4 hover:underline"
            >
              commercial terms
            </a>
            .
          </p>
        </Section>

        <Section title="What we don't do with it">
          <ul className="list-disc space-y-2 pl-5">
            <li>We don&apos;t sell your data.</li>
            <li>
              We don&apos;t share it with advertisers or data brokers.
            </li>
            <li>We don&apos;t use it to train AI models.</li>
            <li>We don&apos;t profile you for targeted advertising.</li>
            <li>
              We don&apos;t share it with anyone except the third-party
              services we need to operate (Plaid for bank connections,
              Supabase for storage, Anthropic for question answering, Resend
              for emails).
            </li>
          </ul>
        </Section>

        <Section title="Your controls">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="font-semibold text-text-primary">
                Unlink a bank
              </strong>{" "}
              anytime from Settings. We stop pulling new balances and
              archive the linked accounts.
            </li>
            <li>
              <strong className="font-semibold text-text-primary">
                Delete an account
              </strong>{" "}
              from its detail page. The account row + its history archive
              but stay restorable for 90 days.
            </li>
            <li>
              <strong className="font-semibold text-text-primary">
                Turn off email reminders
              </strong>{" "}
              in Settings → Preferences.
            </li>
            <li>
              <strong className="font-semibold text-text-primary">
                Delete everything
              </strong>{" "}
              by emailing{" "}
              <a
                href="mailto:coo@revarity.com"
                className="text-accent-primary underline-offset-4 hover:underline"
              >
                coo@revarity.com
              </a>
              . We&apos;ll hard-delete your account, all bank connections,
              all history, all hints, all reflections — within 14 days.
            </li>
          </ul>
        </Section>

        <Section title="Security">
          <p>
            We use industry-standard encryption (TLS 1.3 in transit,
            pgsodium-managed AES-256-GCM at rest for bank tokens). We
            don&apos;t store your bank password — Plaid handles authentication
            on your bank&apos;s own login page and only returns us a refresh
            token. We don&apos;t store your social security number, your
            address, or any government identifier. We don&apos;t store
            transactions yet — only balances, account metadata, and what you
            type into the app.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If we change how Vigilance handles your data, we&apos;ll update
            this page and email you at the address on file before the change
            takes effect.
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

      <footer className="mt-16 space-y-3 border-t border-text-primary/10 pt-8 text-[13px] text-text-muted">
        <div className="flex flex-wrap gap-4">
          <Link href="/privacy" className="hover:text-text-primary">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-text-primary">
            Terms
          </Link>
          <a href="mailto:coo@revarity.com" className="hover:text-text-primary">
            coo@revarity.com
          </a>
        </div>
        <div>
          Built by{" "}
          <a
            href="https://revarity.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-primary"
          >
            Revarity LLC
          </a>
        </div>
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
