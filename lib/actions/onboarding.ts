"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const SUPPORTED_CURRENCIES = ["USD", "CAD", "EUR", "PYG"] as const;

const LocaleInput = z.object({
  timezone: z.string().min(1).max(64),
  currency: z.enum(SUPPORTED_CURRENCIES),
});

/**
 * Smart defaults (WS3 Task 3.4). Runs once, silently, on the user's first
 * app load: sets home_currency + timezone from the browser locale so the
 * user never has to choose. No-ops if locale_detected is already true (so a
 * user who later picks their own values in Settings isn't overwritten).
 */
export async function setLocaleDefaults(input: {
  timezone: string;
  currency: string;
}): Promise<{ applied: boolean }> {
  const parsed = LocaleInput.safeParse(input);
  if (!parsed.success) return { applied: false };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { applied: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("locale_detected")
    .eq("id", user.id)
    .single();
  if (!profile || profile.locale_detected) return { applied: false };

  await supabase
    .from("profiles")
    .update({
      home_currency: parsed.data.currency,
      timezone: parsed.data.timezone,
      locale_detected: true,
    })
    .eq("id", user.id);

  revalidatePath("/app");
  revalidatePath("/app/settings");
  return { applied: true };
}

/**
 * Marks the one-time "There you are" welcome moment as shown (WS3 Task 3.2)
 * so it never fires again.
 */
export async function markWelcomed(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").update({ welcomed: true }).eq("id", user.id);
}
