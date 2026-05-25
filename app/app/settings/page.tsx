import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Cog } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
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
          Settings
        </div>
        <div className="w-9" />
      </header>

      <h1 className="mb-8 text-3xl font-bold tracking-[-0.025em] text-text-primary">
        Settings
      </h1>

      <section className="mt-12 flex flex-col items-center text-center">
        <Cog className="h-10 w-10 text-text-muted" />
        <div className="mt-5 text-sm font-semibold text-text-primary">
          Coming soon
        </div>
        <p className="mx-auto mt-3 max-w-[300px] text-xs leading-relaxed text-text-secondary">
          Currency picker, hint thresholds, jurisdiction list, ritual cadence,
          archived account restore. Day 3 work.
        </p>
        <p className="mx-auto mt-2 max-w-[300px] text-[11px] leading-relaxed text-text-muted">
          Signed in as {user.email}
        </p>
      </section>
    </>
  );
}
