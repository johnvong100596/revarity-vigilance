"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { sendEmail } from "@/lib/email/send";
import WorkspaceInviteEmail from "@/lib/email/WorkspaceInviteEmail";
import { createClient } from "@/lib/supabase/server";

/* ── Create workspace ──────────────────────────────────────────── */

const CreateWorkspaceInput = z.object({
  name: z.string().min(1, "Name is required").max(64),
});

export async function createWorkspace(input: { name: string }) {
  const { name } = CreateWorkspaceInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({ name: name.trim(), owner_user_id: user.id })
    .select()
    .single();
  if (error || !workspace) {
    throw new Error(`Create workspace failed: ${error?.message ?? "no row"}`);
  }

  // Owner becomes the first accepted member
  const { error: memberErr } = await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    invited_email: user.email ?? "",
    invite_token: randomBytes(24).toString("hex"),
    role: "owner",
    invited_by_user_id: user.id,
    accepted_at: new Date().toISOString(),
  });
  if (memberErr) {
    throw new Error(`Add owner member failed: ${memberErr.message}`);
  }

  revalidatePath("/app/settings");
  return workspace.id;
}

/* ── Switch active workspace ───────────────────────────────────── */

const SwitchInput = z.object({ workspaceId: z.string().uuid() });

export async function switchWorkspace(input: { workspaceId: string }) {
  const { workspaceId } = SwitchInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Membership check is enforced by RLS — if the user isn't a member of
  // workspaceId, this update returns zero rows (no failure, but the
  // active_workspace_id won't change).
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .maybeSingle();
  if (!membership) {
    throw new Error("You are not a member of that workspace");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ active_workspace_id: workspaceId })
    .eq("id", user.id);
  if (error) throw new Error(`Switch failed: ${error.message}`);

  revalidatePath("/app");
  revalidatePath("/app/settings");
  revalidatePath("/app/checkin");
  revalidatePath("/app/reckoning");
  revalidatePath("/app/close");
  revalidatePath("/app/hints");
}

/* ── Invite a member ───────────────────────────────────────────── */

const InviteInput = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["owner", "admin", "member"]).default("member"),
});

export async function inviteMember(input: {
  workspaceId: string;
  email: string;
  role?: "owner" | "admin" | "member";
}): Promise<{ inviteUrl: string; emailSent: boolean; emailReason?: string }> {
  const parsed = InviteInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const token = randomBytes(24).toString("hex");
  const { error } = await supabase.from("workspace_members").insert({
    workspace_id: parsed.workspaceId,
    invited_email: parsed.email.trim().toLowerCase(),
    invite_token: token,
    role: parsed.role,
    invited_by_user_id: user.id,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error(`${parsed.email} is already invited to this workspace`);
    }
    throw new Error(`Invite failed: ${error.message}`);
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://vigilance.revarity.com";
  const inviteUrl = `${baseUrl}/accept-invite/${token}`;

  // Send the invite email via Resend. Best-effort — if Resend isn't
  // configured or send fails, the owner can still copy the inviteUrl
  // from the UI and forward it manually.
  const [{ data: workspaceRow }, { data: inviterProfile }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("name")
      .eq("id", parsed.workspaceId)
      .single(),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single(),
  ]);

  const sendResult = await sendEmail({
    to: parsed.email.trim().toLowerCase(),
    subject: `${(inviterProfile?.display_name as string) || "Someone"} invited you to ${(workspaceRow?.name as string) || "a workspace"} on Vigilance`,
    component: WorkspaceInviteEmail({
      inviterName:
        (inviterProfile?.display_name as string) || user.email || "Someone",
      workspaceName: (workspaceRow?.name as string) || "Workspace",
      role: parsed.role ?? "member",
      acceptUrl: inviteUrl,
    }),
  });

  revalidatePath("/app/settings");
  return {
    inviteUrl,
    emailSent: sendResult.sent,
    emailReason: sendResult.reason,
  };
}

/* ── Accept invite ─────────────────────────────────────────────── */

const AcceptInput = z.object({ token: z.string().min(8) });

export async function acceptInvite(input: { token: string }): Promise<string> {
  const { token } = AcceptInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first, then we'll add you to the workspace");

  const { data, error } = await supabase.rpc("accept_workspace_invite", {
    token,
  });
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app");
  revalidatePath("/app/settings");
  return data as string;
}

/* ── Leave workspace ───────────────────────────────────────────── */

const LeaveInput = z.object({ workspaceId: z.string().uuid() });

export async function leaveWorkspace(input: { workspaceId: string }) {
  const { workspaceId } = LeaveInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Owner can't leave — they have to delete the workspace or transfer
  // ownership first. (Transfer not implemented in v1.)
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("owner_user_id")
    .eq("id", workspaceId)
    .single();
  if (workspace?.owner_user_id === user.id) {
    throw new Error(
      "You're the owner. Delete the workspace or transfer ownership first."
    );
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id);
  if (error) throw new Error(`Leave failed: ${error.message}`);

  // If they just left their active workspace, fall back to their personal
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", user.id)
    .single();
  if (profile?.active_workspace_id === workspaceId) {
    const { data: personal } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (personal) {
      await supabase
        .from("profiles")
        .update({ active_workspace_id: personal.id })
        .eq("id", user.id);
    }
  }

  revalidatePath("/app/settings");
  revalidatePath("/app");
  redirect("/app");
}

/* ── Remove a member ───────────────────────────────────────────── */

const RemoveInput = z.object({ memberId: z.string().uuid() });

export async function removeMember(input: { memberId: string }) {
  const { memberId } = RemoveInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // RLS enforces owner/admin-only at DB level. Just delete.
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("id", memberId);
  if (error) throw new Error(`Remove member failed: ${error.message}`);

  revalidatePath("/app/settings");
}
