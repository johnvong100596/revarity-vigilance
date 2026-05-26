import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { acceptInvite } from "@/lib/actions/workspaces";
import { createClient } from "@/lib/supabase/server";

interface AcceptInvitePageProps {
  params: { token: string };
}

export default async function AcceptInvitePage({
  params,
}: AcceptInvitePageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in — bounce to login, preserve the token in `next` so they
  // come back here after the magic link
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/accept-invite/${params.token}`)}`);
  }

  // Peek the invite via SECURITY DEFINER RPC — the invitee isn't yet a
  // member of the workspace, so the workspace_members SELECT policy
  // would deny a direct query. peek_workspace_invite validates the
  // email match and returns the metadata needed to render this page.
  const { data: peekRows } = await supabase.rpc("peek_workspace_invite", {
    token: params.token,
  });
  const peek = Array.isArray(peekRows) ? peekRows[0] : null;
  const invite = peek
    ? {
        workspace_id: peek.workspace_id as string,
        invited_email: peek.invited_email as string,
        role: peek.role as string,
        accepted_at: peek.accepted_at as string | null,
        workspace_name: peek.workspace_name as string,
        email_matches_current_user:
          peek.email_matches_current_user as boolean,
      }
    : null;

  if (!invite) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-6 py-12 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-negative">
          Invite not found
        </div>
        <h1 className="mt-4 max-w-[420px] text-balance text-[36px] font-bold leading-tight tracking-[-0.025em]">
          This link doesn&apos;t work anymore.
        </h1>
        <p className="mx-auto mt-5 max-w-[340px] text-sm leading-relaxed text-text-secondary">
          The invite may have been revoked or already accepted. Ask whoever
          sent it to send a fresh one.
        </p>
        <Link
          href="/app"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Go to my workspace
        </Link>
      </main>
    );
  }

  const workspaceName = invite.workspace_name ?? "Workspace";

  if (invite.accepted_at) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-6 py-12 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-positive">
          Already accepted
        </div>
        <h1 className="mt-4 max-w-[420px] text-balance text-[36px] font-bold leading-tight tracking-[-0.025em]">
          You&apos;re already in {workspaceName}.
        </h1>
        <Link
          href="/app"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Open it
        </Link>
      </main>
    );
  }

  // Email mismatch check — display gracefully before the form even attempts
  if (
    user.email &&
    invite.invited_email.toLowerCase() !== user.email.toLowerCase()
  ) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-6 py-12 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-negative">
          Wrong email
        </div>
        <h1 className="mt-4 max-w-[420px] text-balance text-[36px] font-bold leading-tight tracking-[-0.025em]">
          This invite was sent to <br />
          {invite.invited_email}.
        </h1>
        <p className="mx-auto mt-5 max-w-[360px] text-sm leading-relaxed text-text-secondary">
          You&apos;re signed in as {user.email}. Sign out and sign back in
          with the right email to accept, or ask the inviter to send a new
          invite to your current email.
        </p>
        <Link
          href="/app/settings"
          className="mt-8 text-sm font-semibold text-text-secondary underline-offset-4 hover:underline"
        >
          Open Settings to sign out
        </Link>
      </main>
    );
  }

  async function handleAccept() {
    "use server";
    await acceptInvite({ token: params.token });
    redirect("/app");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-6 py-12 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-primary">
        Workspace invite
      </div>
      <h1 className="mt-4 max-w-[420px] text-balance text-[36px] font-bold leading-tight tracking-[-0.025em] md:text-[44px]">
        Join {workspaceName}.
      </h1>
      <p className="mx-auto mt-5 max-w-[340px] text-sm leading-relaxed text-text-secondary">
        You&apos;ll see this workspace&apos;s connected banks, balances,
        and hints. Your role will be{" "}
        <span className="font-semibold text-text-primary">{invite.role}</span>.
      </p>
      <form action={handleAccept}>
        <button
          type="submit"
          className="group mt-8 inline-flex items-center gap-2 rounded-full bg-accent-primary px-7 py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Accept invite
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </button>
      </form>
      <Link
        href="/app"
        className="mt-4 text-[11px] text-text-muted underline-offset-4 hover:underline"
      >
        Not now
      </Link>
    </main>
  );
}
