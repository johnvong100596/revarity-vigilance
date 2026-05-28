import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  ArchivedAccountRow,
  PlaidItemCard,
  SignOutButton,
  ToggleRow,
  WorkspaceSection,
} from "./settings-client";
import { ReferralCard } from "@/components/ReferralCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/lib/actions/settings";
import { getCachedLogosMap, type InstitutionLogo } from "@/lib/institution-logos";
import { CURRENCIES } from "@/lib/money";
import { TIMEZONE_OPTIONS } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import type { Account, Profile, WorkspaceMember } from "@/lib/types";

interface PlaidItemRow {
  id: string;
  institution_name: string | null;
  institution_id: string | null;
  last_sync_at: string | null;
  status: string;
}

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  const profile = (profileRow ?? null) as Profile | null;
  if (!profile?.active_workspace_id) redirect("/login");
  const workspaceId = profile.active_workspace_id;

  const [archivedRes, plaidItemsRes, workspacesRes, membersRes, invitedCountRes] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("id, name, subtitle")
        .eq("workspace_id", workspaceId)
        .eq("archived", true)
        .order("name", { ascending: true }),
      supabase
        .from("plaid_items")
        .select("id, institution_name, institution_id, last_sync_at, status")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
      supabase
        .from("workspace_members")
        .select("workspace_id, role, workspaces!inner(id, name, owner_user_id)")
        .eq("user_id", user.id)
        .not("accepted_at", "is", null),
      supabase
        .from("workspace_members")
        .select("id, user_id, invited_email, role, invited_at, accepted_at")
        .eq("workspace_id", workspaceId)
        .order("invited_at", { ascending: true }),
      // Count of profiles this user has personally invited
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("invited_by_user_id", user.id),
    ]);
  const invitedCount = invitedCountRes.count ?? 0;

  const archived = (archivedRes.data ?? []) as Pick<
    Account,
    "id" | "name" | "subtitle"
  >[];
  const plaidItems = (plaidItemsRes.data ?? []) as PlaidItemRow[];

  // Institution logos for the connected-banks list (best-effort)
  const itemInstitutionIds = plaidItems
    .map((i) => i.institution_id)
    .filter((id): id is string => Boolean(id));
  const itemLogoMap: Record<string, InstitutionLogo> =
    itemInstitutionIds.length > 0
      ? await getCachedLogosMap(supabase, itemInstitutionIds).catch(
          () => ({}) as Record<string, InstitutionLogo>
        )
      : {};
  // Supabase JS resolves the !inner join inconsistently — sometimes the
  // joined row is returned as an object, sometimes as a single-element
  // array depending on the inferred FK. Normalize via unknown cast.
  type RawMembershipRow = {
    workspace_id: string;
    role: "owner" | "admin" | "member";
    workspaces:
      | { id: string; name: string; owner_user_id: string }
      | { id: string; name: string; owner_user_id: string }[]
      | null;
  };
  const rawMemberships = (workspacesRes.data ?? []) as unknown as RawMembershipRow[];
  const memberships = rawMemberships.map((m) => {
    const ws = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
    return {
      id: m.workspace_id,
      name: ws?.name ?? "Workspace",
      role: m.role,
      isActive: m.workspace_id === workspaceId,
    };
  });
  const members = (membersRes.data ?? []) as Pick<
    WorkspaceMember,
    "id" | "user_id" | "invited_email" | "role" | "invited_at" | "accepted_at"
  >[];
  const activeWorkspace = memberships.find((m) => m.isActive);
  const myRole = activeWorkspace?.role ?? "member";

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

      {/* Profile */}
      <section className="mb-10">
        <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Profile
        </div>
        <form action={updateProfile} className="space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="displayName"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary"
            >
              Display name
            </Label>
            <Input
              id="displayName"
              name="displayName"
              maxLength={64}
              defaultValue={profile?.display_name ?? ""}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="homeCurrency"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary"
            >
              Home currency
            </Label>
            <select
              id="homeCurrency"
              name="homeCurrency"
              defaultValue={profile?.home_currency ?? "USD"}
              className="flex h-11 w-full rounded-md border border-text-primary/12 bg-bg-tertiary px-3.5 py-2 text-sm text-text-primary focus-visible:border-accent-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/15"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <p className="text-[11px] leading-relaxed text-text-muted">
              All net-worth totals and ritual screens display in this
              currency. Multi-currency accounts get FX-converted at snapshot
              time (Day 6 cron lands the live rate feed).
            </p>
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="timezone"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary"
            >
              Time zone
            </Label>
            <select
              id="timezone"
              name="timezone"
              defaultValue={profile?.timezone ?? "America/New_York"}
              className="flex h-11 w-full rounded-md border border-text-primary/12 bg-bg-tertiary px-3.5 py-2 text-sm text-text-primary focus-visible:border-accent-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/15"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] leading-relaxed text-text-muted">
              Your daily streak rolls over at midnight in this time zone, so
              an evening check-in still counts for today.
            </p>
          </div>
          <Button type="submit" className="w-full">
            Save profile
          </Button>
        </form>
      </section>

      {/* Workspace */}
      <WorkspaceSection
        activeWorkspaceId={workspaceId}
        memberships={memberships}
        members={members}
        currentUserId={user.id}
        currentUserRole={myRole}
      />

      {/* Preferences */}
      <section className="mb-10">
        <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Preferences
        </div>
        <div className="rounded-card border border-text-primary/8 bg-bg-tertiary px-4 divide-y divide-text-primary/6">
          <ToggleRow
            label="Expert hints"
            description="Surface CFO-grade insights as you check in. Turn off to skip the hint engine entirely."
            field="expert_hints_enabled"
            initial={profile?.expert_hints_enabled ?? true}
          />
          <ToggleRow
            label="Re-engage prompt"
            description="Replace the home with a full-screen nudge when you've gone 14+ days without checking in. The small amber dots on stale accounts stay on either way."
            field="decay_warnings_enabled"
            initial={profile?.decay_warnings_enabled ?? true}
          />
          <ToggleRow
            label="Sunday Reckoning email"
            description="Short weekly email Sunday morning with your week's net-worth change and top hints. Links straight into your Reckoning."
            field="weekly_email_enabled"
            initial={(profile as { weekly_email_enabled?: boolean })?.weekly_email_enabled ?? true}
          />
          <ToggleRow
            label="Monthly Close email"
            description="Short email on the 1st of each month with your month-over-month change. Links into the Monthly Close to lock the month."
            field="monthly_email_enabled"
            initial={(profile as { monthly_email_enabled?: boolean })?.monthly_email_enabled ?? true}
          />
        </div>
      </section>

      {/* Plaid connections */}
      <section className="mb-10">
        <div className="mb-1 flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Connected banks
          </div>
          {plaidItems.length > 0 && (
            <Link
              href="/app/accounts/add"
              className="text-xs font-medium text-accent-primary underline-offset-4 hover:underline"
            >
              + Connect another
            </Link>
          )}
        </div>
        <p className="mb-4 text-[11px] text-text-muted">
          Encrypted and read-only. We can see your balances but can never move
          your money.
        </p>
        {plaidItems.length === 0 ? (
          <div className="rounded-card border border-text-primary/8 bg-bg-tertiary px-4 py-4 text-center">
            <p className="text-xs leading-relaxed text-text-secondary">
              Connect your first bank to see your money in one place.
            </p>
            <Link
              href="/app/accounts/add"
              className="mt-3 inline-flex items-center text-xs font-semibold text-accent-primary underline-offset-4 hover:underline"
            >
              Connect a bank →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {plaidItems.map((item) => (
              <PlaidItemCard
                key={item.id}
                id={item.id}
                institution={item.institution_name ?? "Unnamed institution"}
                lastSyncAt={item.last_sync_at}
                status={item.status}
                logoBase64={
                  item.institution_id
                    ? itemLogoMap[item.institution_id]?.logo_base64 ?? null
                    : null
                }
                colorPrimary={
                  item.institution_id
                    ? itemLogoMap[item.institution_id]?.color_primary ?? null
                    : null
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Archived accounts */}
      <section className="mb-10">
        <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Archived accounts
        </div>
        {archived.length === 0 ? (
          <div className="rounded-card border border-text-primary/8 bg-bg-tertiary px-4 py-3 text-xs text-text-secondary">
            No archived accounts. Archiving from the account detail page brings
            them here for recovery.
          </div>
        ) : (
          <div className="rounded-card border border-text-primary/8 bg-bg-tertiary px-4 divide-y divide-text-primary/6">
            {archived.map((a) => (
              <ArchivedAccountRow
                key={a.id}
                id={a.id}
                name={a.name}
                subtitle={a.subtitle}
              />
            ))}
          </div>
        )}
      </section>

      {/* Referral */}
      {profile.referral_token && (
        <section className="mb-10">
          <ReferralCard
            referralToken={profile.referral_token}
            invitedCount={invitedCount}
            siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? "https://vigilance.revarity.com"}
          />
        </section>
      )}

      {/* Account */}
      <section className="mb-12">
        <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Account
        </div>
        <div className="mb-4 rounded-card border border-text-primary/8 bg-bg-tertiary px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Signed in as
          </div>
          <div className="mt-1 text-sm font-medium text-text-primary">
            {user.email}
          </div>
        </div>
        <SignOutButton />
      </section>

      <footer className="space-y-3 text-center text-[11px] leading-relaxed text-text-muted">
        <div className="flex justify-center gap-4">
          <Link href="/privacy" className="hover:text-text-primary">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-text-primary">
            Terms
          </Link>
          <a
            href="mailto:coo@revarity.com"
            className="hover:text-text-primary"
          >
            Contact
          </a>
        </div>
        <div>
          Vigilance · built by{" "}
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
    </>
  );
}
