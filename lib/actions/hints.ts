"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const HintIdInput = z.object({ hintId: z.string().uuid() });

export async function dismissHint(input: { hintId: string }) {
  const { hintId } = HintIdInput.parse(input);
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
    .select("dismissed_count")
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
  const { error } = await supabase
    .from("hints")
    .update({
      status: "acted",
      acted_at: new Date().toISOString(),
    })
    .eq("id", hintId);
  if (error) throw new Error(`resolve failed: ${error.message}`);

  revalidatePath("/app/hints");
  revalidatePath("/app");
}
