import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AccountDetailClient, type SnapshotPoint } from "./account-detail-client";
import { createClient } from "@/lib/supabase/server";
import type { Account } from "@/lib/types";

interface AccountDetailPageProps {
  params: { id: string };
}

export default async function AccountDetailPage({
  params,
}: AccountDetailPageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS scopes by workspace membership — no explicit user_id needed.
  // Workspace-scoped accounts visible to the user are the union of all
  // workspaces they're a member of; account UUID is the unique key.
  const [accountRes, snapshotsRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("id", params.id)
      .eq("archived", false)
      .maybeSingle(),
    supabase
      .from("balance_snapshots")
      .select("balance, captured_at")
      .eq("account_id", params.id)
      .order("captured_at", { ascending: true })
      .limit(60),
  ]);

  const account = accountRes.data as Account | null;
  if (!account) notFound();

  const snapshots: SnapshotPoint[] = (snapshotsRes.data ?? []).map((s) => ({
    capturedAt: s.captured_at as string,
    balance: Number(s.balance),
  }));

  // If we have no snapshots at all yet (rare — initial add creates one
  // implicitly via the editAccountBalance path, but a freshly-inserted
  // manual account may have none), inject the current balance as the
  // single point so the chart has SOMETHING to render.
  if (snapshots.length === 0) {
    snapshots.push({
      capturedAt: account.last_balance_updated_at ?? account.created_at,
      balance: Number(account.balance),
    });
  }

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
          Account
        </div>
        <div className="w-9" />
      </header>

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-[-0.025em] text-text-primary">
          {account.name}
        </h1>
        {account.subtitle && (
          <div className="mt-1 text-sm text-text-secondary">
            {account.subtitle}
          </div>
        )}
      </div>

      <AccountDetailClient account={account} snapshots={snapshots} />
    </>
  );
}
