"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const CurrencyEnum = z.enum(["USD", "CAD", "EUR", "PYG"]);
const DirectionEnum = z.enum(["owed_to_me", "i_owe"]);

const RecurringSchema = z
  .object({
    frequency: z.literal("monthly"),
    day_of_month: z.number().int().min(1).max(31),
  })
  .nullable()
  .optional();

const CreateIouInput = z.object({
  entityId: z.string().uuid().nullable().optional(),
  counterpartyName: z.string().trim().min(1).max(80),
  amount: z.number().min(0),
  currency: CurrencyEnum,
  direction: DirectionEnum,
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  recurring: RecurringSchema,
  notes: z.string().max(500).optional().nullable(),
});

export async function createIou(input: {
  entityId?: string | null;
  counterpartyName: string;
  amount: number;
  currency: "USD" | "CAD" | "EUR" | "PYG";
  direction: "owed_to_me" | "i_owe";
  dueDate?: string | null;
  recurring?: { frequency: "monthly"; day_of_month: number } | null;
  notes?: string | null;
}) {
  const parsed = CreateIouInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase.from("ious").insert({
    user_id: user.id,
    entity_id: parsed.entityId ?? null,
    counterparty_name: parsed.counterpartyName,
    amount: parsed.amount,
    currency: parsed.currency,
    direction: parsed.direction,
    due_date: parsed.dueDate ?? null,
    recurring: parsed.recurring ?? null,
    notes: parsed.notes ?? null,
  });
  if (error) throw new Error(`Could not add: ${error.message}`);

  revalidatePath("/app/ious");
  revalidatePath("/app");
}

const SettleInput = z.object({ id: z.string().uuid() });

export async function settleIou(input: { id: string }) {
  const { id } = SettleInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("ious")
    .update({ status: "settled", settled_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Could not settle: ${error.message}`);

  revalidatePath("/app/ious");
  revalidatePath("/app");
}

export async function reopenIou(input: { id: string }) {
  const { id } = SettleInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("ious")
    .update({ status: "active", settled_at: null })
    .eq("id", id);
  if (error) throw new Error(`Could not reopen: ${error.message}`);

  revalidatePath("/app/ious");
  revalidatePath("/app");
}

export async function deleteIou(input: { id: string }) {
  const { id } = SettleInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase.from("ious").delete().eq("id", id);
  if (error) throw new Error(`Could not delete: ${error.message}`);

  revalidatePath("/app/ious");
  revalidatePath("/app");
}

/* ── Inter-entity flows (WS8) ─────────────────────────────────── */

const CreateFlowInput = z.object({
  fromEntityId: z.string().uuid(),
  toEntityId: z.string().uuid(),
  amount: z.number().min(0),
  currency: CurrencyEnum,
  purpose: z.string().max(200).optional().nullable(),
  flowDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function createFlow(input: {
  fromEntityId: string;
  toEntityId: string;
  amount: number;
  currency: "USD" | "CAD" | "EUR" | "PYG";
  purpose?: string | null;
  flowDate?: string;
}) {
  const parsed = CreateFlowInput.parse(input);
  if (parsed.fromEntityId === parsed.toEntityId) {
    throw new Error("Pick two different businesses.");
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  // Both entities must belong to this user (RLS would block otherwise,
  // but a clear error is friendlier than a Postgres complaint)
  const { data: ents } = await supabase
    .from("entities")
    .select("id, user_id")
    .in("id", [parsed.fromEntityId, parsed.toEntityId]);
  if (
    !ents ||
    ents.length !== 2 ||
    ents.some((e) => e.user_id !== user.id)
  ) {
    throw new Error("Those businesses aren't yours.");
  }

  const { error } = await supabase.from("inter_entity_flows").insert({
    user_id: user.id,
    from_entity_id: parsed.fromEntityId,
    to_entity_id: parsed.toEntityId,
    amount: parsed.amount,
    currency: parsed.currency,
    purpose: parsed.purpose ?? null,
    flow_date: parsed.flowDate ?? new Date().toISOString().slice(0, 10),
  });
  if (error) throw new Error(`Could not add: ${error.message}`);

  revalidatePath("/app/ious");
  revalidatePath("/app");
}

const FlowIdInput = z.object({ id: z.string().uuid() });

export async function settleFlow(input: { id: string }) {
  const { id } = FlowIdInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("inter_entity_flows")
    .update({ status: "settled", settled_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Could not settle: ${error.message}`);

  revalidatePath("/app/ious");
  revalidatePath("/app");
}

export async function deleteFlow(input: { id: string }) {
  const { id } = FlowIdInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("inter_entity_flows")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Could not delete: ${error.message}`);

  revalidatePath("/app/ious");
  revalidatePath("/app");
}
