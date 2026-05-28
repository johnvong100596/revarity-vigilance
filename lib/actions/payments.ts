"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const MarkInput = z.object({
  accountId: z.string().uuid(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function markPaymentPaid(input: {
  accountId: string;
  dueDate: string;
}) {
  const parsed = MarkInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase.from("payment_marks").insert({
    user_id: user.id,
    account_id: parsed.accountId,
    due_date: parsed.dueDate,
  });
  // Unique constraint = already marked = treat as success
  if (error && error.code !== "23505") {
    throw new Error(`Could not mark paid: ${error.message}`);
  }

  revalidatePath("/app");
}

export async function unmarkPaymentPaid(input: {
  accountId: string;
  dueDate: string;
}) {
  const parsed = MarkInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("payment_marks")
    .delete()
    .eq("user_id", user.id)
    .eq("account_id", parsed.accountId)
    .eq("due_date", parsed.dueDate);
  if (error) throw new Error(`Could not undo: ${error.message}`);

  revalidatePath("/app");
}
