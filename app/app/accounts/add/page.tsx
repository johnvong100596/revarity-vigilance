import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";

import { PlaidLinkButton } from "@/components/PlaidLinkButton";
import { createClient } from "@/lib/supabase/server";

export default async function AddAccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <header className="mb-8 flex items-center justify-between">
        <Link
          href="/app"
          aria-label="Back"
          className="-m-2 p-2 text-text-secondary transition hover:text-text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Add an account
        </div>
        <div className="w-9" />
      </header>

      <h1 className="mb-3 text-3xl font-bold tracking-[-0.025em] text-text-primary">
        Connect your bank
      </h1>
      <p className="mb-8 text-[15px] leading-relaxed text-text-secondary">
        Vigilance pulls your balances automatically using Plaid — the
        bank-connection service trusted by 12,000+ banks. Read-only access.
        Your sign-in credentials never touch our servers.
      </p>

      <section className="mb-8">
        <PlaidLinkButton />
      </section>

      <div className="rounded-card border border-text-primary/8 bg-bg-tertiary p-4">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
          <Lock className="h-3 w-3" />
          What we see, what we don&apos;t
        </div>
        <ul className="space-y-1.5 text-xs leading-relaxed text-text-secondary">
          <li>
            <span className="text-text-primary">We see:</span> balances,
            account names, statement dates, and (for credit cards) the yearly
            interest rate and minimum payment.
          </li>
          <li>
            <span className="text-text-primary">We don&apos;t see:</span> your
            online banking password, your card number, or who you pay. We
            can&apos;t move money — connections are read-only.
          </li>
          <li>
            <span className="text-text-primary">You control it:</span> remove
            the connection anytime from Settings. Past data stays archived for
            you to recover.
          </li>
        </ul>
      </div>
    </>
  );
}
