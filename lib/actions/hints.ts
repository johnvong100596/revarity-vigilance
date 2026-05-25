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
  const { data: existing } = await supabase
    .from("hints")
    .select("dismissed_count")
    .eq("id", hintId)
    .eq("user_id", user.id)
    .single();

  const newCount = (existing?.dismissed_count ?? 0) + 1;

  const { error } = await supabase
    .from("hints")
    .update({
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
      dismissed_count: newCount,
    })
    .eq("id", hintId)
    .eq("user_id", user.id);
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

  const { error } = await supabase
    .from("hints")
    .update({
      status: "acted",
      acted_at: new Date().toISOString(),
    })
    .eq("id", hintId)
    .eq("user_id", user.id);
  if (error) throw new Error(`resolve failed: ${error.message}`);

  revalidatePath("/app/hints");
  revalidatePath("/app");
}
