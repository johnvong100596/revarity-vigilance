import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Lightbulb } from "lucide-react";

import { HintsClient } from "./hints-client";
import { createClient } from "@/lib/supabase/server";
import type { Hint } from "@/lib/types";

export default async function HintsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", user.id)
    .single();
  if (!profile?.active_workspace_id) redirect("/login");

  const { data } = await supabase
    .from("hints")
    .select("*")
    .eq("workspace_id", profile.active_workspace_id)
    .eq("status", "active")
    .order("severity_score", { ascending: false })
    .order("fired_at", { ascending: false });

  const hints = (data ?? []) as Hint[];

  const byCategory = {
    pay_attention: hints.filter((h) => h.category === "pay_attention"),
    opportunity: hints.filter((h) => h.category === "opportunity"),
    strategic: hints.filter((h) => h.category === "strategic"),
  };

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
          Hints
        </div>
        <div className="w-9" />
      </header>

      <h1 className="mb-8 text-3xl font-bold tracking-[-0.025em] text-text-primary">
        Expert hints
      </h1>

      {hints.length === 0 ? (
        <section className="mt-16 flex flex-col items-center text-center">
          <Lightbulb className="h-10 w-10 text-text-muted" />
          <div className="mt-5 text-sm font-semibold text-text-primary">
            No active hints
          </div>
          <p className="mx-auto mt-3 max-w-[280px] text-xs leading-relaxed text-text-secondary">
            Hints fire when your accounts trigger one of the expert rules. Keep
            checking in — they&apos;ll show up here.
          </p>
        </section>
      ) : (
        <HintsClient
          payAttention={byCategory.pay_attention}
          opportunity={byCategory.opportunity}
          strategic={byCategory.strategic}
        />
      )}
    </>
  );
}
