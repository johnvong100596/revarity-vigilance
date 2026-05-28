"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const DISMISS_REASONS = ["not_relevant", "already_addressed", "later"] as const;

const DismissInput = z.object({
  hintId: z.string().uuid(),
  reason: z.enum(DISMISS_REASONS).optional(),
});

const HintIdInput = z.object({ hintId: z.string().uuid() });

export async function dismissHint(input: {
  hintId: string;
  reason?: (typeof DISMISS_REASONS)[number];
}) {
  const { hintId, reason } = DismissInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // dismissed_count tracks repeated dismissals — used by the 3-strikes
  // auto-mute logic in THESIS.md §6. Read-modify-write since Postgres
  // doesn't expose increment via the supabase-js update() API.
  // RLS gates by workspace membership now (hints are workspace-scoped) —
  // the old user_id eq blocked teammates from dismissing shared hints.
  const { data: existing } = await supabase
    .from("hints")
    .select("dismissed_count, workspace_id")
    .eq("id", hintId)
    .single();

  const newCount = (existing?.dismissed_count ?? 0) + 1;

  const { error } = await supabase
    .from("hints")
    .update({
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
      dismissed_count: newCount,
    })
    .eq("id", hintId);
  if (error) throw new Error(`dismiss failed: ${error.message}`);

  // Log the dismissal + reason for future targeting (Task 3.1). Best-effort —
  // a failed analytics write must never break the dismiss, but we log it (L2).
  const { error: eventErr } = await supabase.from("hint_events").insert({
    hint_id: hintId,
    user_id: user.id,
    workspace_id: (existing?.workspace_id as string | null) ?? null,
    event_type: "dismissed",
    reason: reason ?? null,
  });
  if (eventErr) console.warn("[hints] dismiss event log failed", eventErr);

  revalidatePath("/app/hints");
  revalidatePath("/app");
}

export async function resolveHint(input: { hintId: string }) {
  const { hintId } = HintIdInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Workspace-scoped via RLS — drop the user_id filter so workspace
  // teammates can mark hints as acted
  const { data: existing } = await supabase
    .from("hints")
    .select("workspace_id")
    .eq("id", hintId)
    .single();

  const { error } = await supabase
    .from("hints")
    .update({
      status: "acted",
      acted_at: new Date().toISOString(),
    })
    .eq("id", hintId);
  if (error) throw new Error(`resolve failed: ${error.message}`);

  const { error: eventErr } = await supabase.from("hint_events").insert({
    hint_id: hintId,
    user_id: user.id,
    workspace_id: (existing?.workspace_id as string | null) ?? null,
    event_type: "resolved",
    reason: null,
  });
  if (eventErr) console.warn("[hints] resolve event log failed", eventErr);

  revalidatePath("/app/hints");
  revalidatePath("/app");
}
