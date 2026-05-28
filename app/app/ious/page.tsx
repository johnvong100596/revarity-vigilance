import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { IousClient } from "@/components/IousClient";
import { createClient } from "@/lib/supabase/server";
import type { Currency } from "@/lib/money";
import type { Entity, InterEntityFlow, Iou } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function IousPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("home_currency, is_operator")
    .eq("id", user.id)
    .single();
  // Operator-only: silently bounce non-operators home — they shouldn't have
  // arrived here. (Nav doesn't link there for non-operators.)
  if (!profile?.is_operator) redirect("/app");

  const [iousRes, flowsRes, entitiesRes] = await Promise.all([
    supabase
      .from("ious")
      .select("*")
      .order("status", { ascending: true }) // active first
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("inter_entity_flows")
      .select("*")
      .order("status", { ascending: true })
      .order("flow_date", { ascending: false }),
    supabase
      .from("entities")
      .select("*")
      .order("is_personal", { ascending: false })
      .order("created_at", { ascending: true }),
  ]);

  const ious = (iousRes.data ?? []) as Iou[];
  const flows = (flowsRes.data ?? []) as InterEntityFlow[];
  const entities = (entitiesRes.data ?? []) as Entity[];

  return (
    <>
      <header className="mb-6 flex items-center gap-2">
        <Link
          href="/app"
          aria-label="Back"
          className="-m-2 p-2 text-text-secondary transition hover:text-text-primary"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold text-text-primary">
          Money in & out
        </h1>
      </header>

      <IousClient
        ious={ious}
        flows={flows}
        entities={entities}
        homeCurrency={(profile.home_currency as Currency) ?? "USD"}
      />
    </>
  );
}
