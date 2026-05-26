import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AddAccountForm } from "./add-account-form";
import { PlaidLinkButton } from "@/components/PlaidLinkButton";
import { createClient } from "@/lib/supabase/server";
import type { Currency } from "@/lib/money";

export default async function AddAccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("home_currency")
    .eq("id", user.id)
    .single();

  const defaultCurrency = (profile?.home_currency as Currency) ?? "USD";

  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <Link
          href="/app"
          aria-label="Back"
          className="-m-2 p-2 text-text-secondary transition hover:text-text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="text-[10px] tracking-[0.2em] text-text-secondary">
          NEW ACCOUNT
        </div>
        <div className="w-5" />
      </header>

      <h1 className="mb-8 text-3xl font-bold tracking-[-0.025em] text-text-primary">
        Add account
      </h1>

      {/* Plaid auto-connect (sandbox) */}
      <section className="mb-8">
        <PlaidLinkButton />
      </section>

      <div className="relative mb-8">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-text-primary/10" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-bg-primary px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Or enter manually
          </span>
        </div>
      </div>

      <AddAccountForm defaultCurrency={defaultCurrency} />
    </>
  );
}
