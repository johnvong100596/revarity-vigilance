"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  disconnectPlaidItem,
  restoreAccount,
  toggleProfileFlag,
} from "@/lib/actions/settings";
import {
  createWorkspace,
  inviteMember,
  leaveWorkspace,
  removeMember,
  switchWorkspace,
} from "@/lib/actions/workspaces";
import { BankIcon } from "@/components/BankIcon";
import { createClient } from "@/lib/supabase/client";
import type { WorkspaceRole } from "@/lib/types";

/* ── Toggle row (instant save) ───────────────────────────────── */

interface ToggleRowProps {
  label: string;
  description?: string;
  field:
    | "expert_hints_enabled"
    | "decay_warnings_enabled"
    | "weekly_email_enabled"
    | "monthly_email_enabled";
  initial: boolean;
}

export function ToggleRow({ label, description, field, initial }: ToggleRowProps) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const next = !value;
    setValue(next);
    startTransition(async () => {
      try {
        await toggleProfileFlag({ field, value: next });
      } catch (err) {
        console.error(err);
        setValue(!next); // revert on failure
      }
    });
  }

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1">
        <div className="text-sm font-medium text-text-primary">{label}</div>
        {description && (
          <div className="mt-0.5 text-xs leading-relaxed text-text-secondary">
            {description}
          </div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={handleClick}
        disabled={pending}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          value ? "bg-accent-primary" : "bg-text-primary/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

/* ── Plaid item card with sync + disconnect ──────────────────── */

interface PlaidItemCardProps {
  id: string;
  institution: string;
  lastSyncAt: string | null;
  status: string;
  logoBase64?: string | null;
  colorPrimary?: string | null;
}

export function PlaidItemCard({
  id,
  institution,
  lastSyncAt,
  status,
  logoBase64,
  colorPrimary,
}: PlaidItemCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(
    lastSyncAt ? new Date(lastSyncAt) : null
  );

  function handleSync() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/plaid/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plaid_item_row_id: id }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `sync failed: ${res.status}`);
        }
        setSyncedAt(new Date());
        router.refresh();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Sync failed");
      }
    });
  }

  function handleDisconnect() {
    if (
      !confirm(
        `Disconnect ${institution}? Linked accounts will be archived but you can reconnect later.`
      )
    )
      return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await disconnectPlaidItem({ plaidItemRowId: id });
        router.refresh();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Disconnect failed");
      }
    });
  }

  const disabled = status !== "active";

  return (
    <div className="rounded-card border border-text-primary/8 bg-bg-tertiary p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <BankIcon
            logoBase64={logoBase64}
            colorPrimary={colorPrimary}
            label={institution}
            size={40}
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-text-primary">
              {institution}
            </div>
            <div className="mt-0.5 text-xs text-text-secondary">
              {syncedAt
                ? `Last synced ${syncedAt.toLocaleString()}`
                : "Never synced"}
              {status !== "active" && (
                <span className="ml-2 rounded-full bg-negative/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-negative">
                  {status}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleSync}
          disabled={pending || disabled}
          className="flex-1 rounded-full border border-text-primary/15 bg-bg-tertiary py-2 text-xs font-semibold text-text-primary transition hover:bg-bg-secondary disabled:opacity-50"
        >
          {pending ? "Working…" : "Sync now"}
        </button>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={pending}
          className="flex-1 rounded-full border border-negative/30 bg-bg-tertiary py-2 text-xs font-semibold text-negative transition hover:bg-negative/5 disabled:opacity-50"
        >
          Disconnect
        </button>
      </div>
      {errorMsg && (
        <p className="mt-2 text-center text-[11px] text-negative">{errorMsg}</p>
      )}
    </div>
  );
}

/* ── Archived account row with restore ───────────────────────── */

interface ArchivedAccountRowProps {
  id: string;
  name: string;
  subtitle: string | null;
}

export function ArchivedAccountRow({
  id,
  name,
  subtitle,
}: ArchivedAccountRowProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleRestore() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await restoreAccount({ accountId: id });
        router.refresh();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Restore failed");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex-1">
        <div className="text-sm font-medium text-text-primary">{name}</div>
        {subtitle && (
          <div className="text-xs text-text-secondary">{subtitle}</div>
        )}
        {errorMsg && (
          <p className="mt-1 text-[11px] text-negative">{errorMsg}</p>
        )}
      </div>
      <button
        type="button"
        onClick={handleRestore}
        disabled={pending}
        className="rounded-full border border-text-primary/15 bg-bg-tertiary px-4 py-1.5 text-xs font-semibold text-text-primary transition hover:bg-bg-secondary disabled:opacity-50"
      >
        {pending ? "Restoring…" : "Restore"}
      </button>
    </div>
  );
}

/* ── Workspaces section ──────────────────────────────────────── */

interface WorkspaceMembershipRow {
  id: string;
  name: string;
  role: WorkspaceRole;
  isActive: boolean;
}

interface WorkspaceMemberRow {
  id: string;
  user_id: string | null;
  invited_email: string;
  role: WorkspaceRole;
  invited_at: string;
  accepted_at: string | null;
}

interface WorkspaceSectionProps {
  activeWorkspaceId: string;
  memberships: WorkspaceMembershipRow[];
  members: WorkspaceMemberRow[];
  currentUserId: string;
  currentUserRole: WorkspaceRole;
}

export function WorkspaceSection({
  activeWorkspaceId,
  memberships,
  members,
  currentUserId,
  currentUserRole,
}: WorkspaceSectionProps) {
  const canAdminister =
    currentUserRole === "owner" || currentUserRole === "admin";

  return (
    <section className="mb-10 space-y-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        Workspace
      </div>

      <WorkspaceSwitcher
        activeWorkspaceId={activeWorkspaceId}
        memberships={memberships}
      />

      <WorkspaceMembersList
        members={members}
        currentUserId={currentUserId}
        canAdminister={canAdminister}
      />

      {canAdminister && (
        <WorkspaceInviteForm activeWorkspaceId={activeWorkspaceId} />
      )}

      {currentUserRole !== "owner" && (
        <LeaveWorkspaceButton activeWorkspaceId={activeWorkspaceId} />
      )}

      <CreateWorkspaceForm />
    </section>
  );
}

function WorkspaceSwitcher({
  activeWorkspaceId,
  memberships,
}: {
  activeWorkspaceId: string;
  memberships: WorkspaceMembershipRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleSwitch(workspaceId: string) {
    if (workspaceId === activeWorkspaceId) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await switchWorkspace({ workspaceId });
        router.refresh();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Switch failed");
      }
    });
  }

  return (
    <div className="rounded-card border border-text-primary/8 bg-bg-tertiary p-4">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
        Active workspace
      </div>
      <div className="space-y-2">
        {memberships.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => handleSwitch(m.id)}
            disabled={pending}
            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition disabled:opacity-50 ${
              m.isActive
                ? "bg-accent-soft text-text-primary"
                : "hover:bg-bg-secondary text-text-primary"
            }`}
          >
            <span className="font-medium">{m.name}</span>
            <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
              {m.isActive ? "Current" : m.role}
            </span>
          </button>
        ))}
      </div>
      {errorMsg && (
        <p className="mt-2 text-[11px] text-negative">{errorMsg}</p>
      )}
    </div>
  );
}

function WorkspaceMembersList({
  members,
  currentUserId,
  canAdminister,
}: {
  members: WorkspaceMemberRow[];
  currentUserId: string;
  canAdminister: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleRemove(memberId: string, label: string) {
    if (!confirm(`Remove ${label} from this workspace?`)) return;
    setErrorMsg(null);
    setPendingId(memberId);
    (async () => {
      try {
        await removeMember({ memberId });
        router.refresh();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Remove failed");
      } finally {
        setPendingId(null);
      }
    })();
  }

  return (
    <div className="rounded-card border border-text-primary/8 bg-bg-tertiary">
      <div className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
        Members ({members.length})
      </div>
      <ul className="divide-y divide-text-primary/6">
        {members.map((m) => {
          const isMe = m.user_id === currentUserId;
          const pending = m.accepted_at == null;
          return (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-text-primary">
                  {m.invited_email}
                  {isMe && (
                    <span className="ml-1.5 text-[10px] text-text-muted">
                      (you)
                    </span>
                  )}
                </div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                  {m.role}
                  {pending && " · pending"}
                </div>
              </div>
              {canAdminister && !isMe && (
                <button
                  type="button"
                  onClick={() => handleRemove(m.id, m.invited_email)}
                  disabled={pendingId === m.id}
                  className="text-[11px] font-semibold text-negative underline-offset-4 hover:underline disabled:opacity-50"
                >
                  {pendingId === m.id ? "Removing…" : "Remove"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {errorMsg && (
        <p className="px-4 py-2 text-[11px] text-negative">{errorMsg}</p>
      )}
    </div>
  );
}

function WorkspaceInviteForm({
  activeWorkspaceId,
}: {
  activeWorkspaceId: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [pending, startTransition] = useTransition();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteEmailSent, setInviteEmailSent] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setInviteUrl(null);
    setInviteEmailSent(false);
    startTransition(async () => {
      try {
        const { inviteUrl, emailSent } = await inviteMember({
          workspaceId: activeWorkspaceId,
          email: email.trim().toLowerCase(),
          role,
        });
        setInviteUrl(inviteUrl);
        setInviteEmailSent(emailSent);
        setEmail("");
        router.refresh();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Invite failed");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card border border-text-primary/8 bg-bg-tertiary p-4"
    >
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
        Invite someone
      </div>
      <div className="space-y-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="them@email.com"
          className="flex h-10 w-full rounded-md border border-text-primary/12 bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-primary/15"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as WorkspaceRole)}
          className="flex h-10 w-full rounded-md border border-text-primary/12 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-primary/15"
        >
          <option value="member">Member · read only</option>
          <option value="admin">Admin · can change everything</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending || !email.trim()}
        className="mt-3 w-full rounded-full bg-accent-primary py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send invite"}
      </button>
      {inviteUrl && (
        <div className="mt-3 rounded-md border border-text-primary/10 bg-bg-primary p-3">
          <p className="mb-2 text-[11px] text-text-muted">
            {inviteEmailSent
              ? "Invite sent — they should see it in their inbox shortly. Link below as a backup."
              : "Couldn't send the email automatically. Copy this link and send it to them directly."}
          </p>
          <code className="block break-all text-[11px] text-text-primary">
            {inviteUrl}
          </code>
        </div>
      )}
      {errorMsg && (
        <p className="mt-2 text-center text-[11px] text-negative">{errorMsg}</p>
      )}
    </form>
  );
}

function LeaveWorkspaceButton({
  activeWorkspaceId,
}: {
  activeWorkspaceId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleLeave() {
    if (!confirm("Leave this workspace?")) return;
    startTransition(async () => {
      try {
        await leaveWorkspace({ workspaceId: activeWorkspaceId });
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Leave failed");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleLeave}
      disabled={pending}
      className="text-sm font-semibold text-negative underline-offset-4 hover:underline disabled:opacity-50"
    >
      {pending ? "Leaving…" : "Leave this workspace"}
    </button>
  );
}

function CreateWorkspaceForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await createWorkspace({ name: name.trim() });
        setName("");
        setOpen(false);
        router.refresh();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Create failed");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-accent-primary underline-offset-4 hover:underline"
      >
        + Create a new workspace
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card border border-text-primary/8 bg-bg-tertiary p-4"
    >
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
        New workspace
      </div>
      <input
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Revarity team"
        maxLength={64}
        className="flex h-10 w-full rounded-md border border-text-primary/12 bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary/40 focus:outline-none focus:ring-2 focus:ring-accent-primary/15"
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setName("");
          }}
          className="flex-1 rounded-full border border-text-primary/15 bg-bg-tertiary py-2 text-xs font-semibold text-text-primary hover:bg-bg-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="flex-1 rounded-full bg-accent-primary py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create"}
        </button>
      </div>
      {errorMsg && (
        <p className="mt-2 text-center text-[11px] text-negative">{errorMsg}</p>
      )}
    </form>
  );
}

/* ── Sign out (client-side supabase.auth.signOut) ────────────── */

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const supabase = createClient();
      // signOut() invalidates the session via Supabase Auth API AND clears
      // the cookie via @supabase/ssr — both client and server side are
      // cleared in one call. router.refresh() forces a server re-render
      // against the now-empty session, so the middleware bounces back to /.
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-sm font-semibold text-negative underline-offset-4 transition hover:underline disabled:opacity-50"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
