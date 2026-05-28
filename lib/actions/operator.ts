"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Operator Tier (v1.1 WS1): a single toggle on profiles.is_operator gates
 * the advanced surfaces (entities tagging, IOU ledger, cash runway,
 * cross-entity flow). Default OFF — 90% of users never see any of it.
 * Flipping it ON for the first time seeds the user's "Personal" entity
 * so tagging always has a default home.
 */

const SetOperatorInput = z.object({ value: z.boolean() });

export async function setOperator(input: { value: boolean }): Promise<void> {
  const { value } = SetOperatorInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("profiles")
    .update({ is_operator: value })
    .eq("id", user.id);
  if (error) throw new Error(`operator toggle failed: ${error.message}`);

  // First-time-on: seed the Personal entity if it doesn't exist yet.
  if (value) {
    const { count } = await supabase
      .from("entities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) === 0) {
      await supabase.from("entities").insert({
        user_id: user.id,
        name: "Personal",
        color_hex: "#1A1A1A",
        is_personal: true,
      });
    }
  }

  revalidatePath("/app");
  revalidatePath("/app/settings");
}

/* ── Entity CRUD ───────────────────────────────────────────────── */

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const CreateEntityInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  color_hex: z.string().regex(HEX_RE, "Color must be a hex like #RRGGBB"),
  icon: z.string().max(40).optional().nullable(),
});

export async function createEntity(input: {
  name: string;
  color_hex: string;
  icon?: string | null;
}) {
  const parsed = CreateEntityInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase.from("entities").insert({
    user_id: user.id,
    name: parsed.name,
    color_hex: parsed.color_hex,
    icon: parsed.icon ?? null,
    is_personal: false,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error(`You already have a business named "${parsed.name}".`);
    }
    throw new Error(`Could not add: ${error.message}`);
  }

  revalidatePath("/app/settings");
  revalidatePath("/app");
}

const UpdateEntityInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(40),
  color_hex: z.string().regex(HEX_RE),
  icon: z.string().max(40).optional().nullable(),
});

export async function updateEntity(input: {
  id: string;
  name: string;
  color_hex: string;
  icon?: string | null;
}) {
  const parsed = UpdateEntityInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("entities")
    .update({
      name: parsed.name,
      color_hex: parsed.color_hex,
      icon: parsed.icon ?? null,
    })
    .eq("id", parsed.id);
  if (error) throw new Error(`Could not save: ${error.message}`);

  revalidatePath("/app/settings");
  revalidatePath("/app");
}

const DeleteEntityInput = z.object({ id: z.string().uuid() });

export async function deleteEntity(input: { id: string }) {
  const { id } = DeleteEntityInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  // UI prevents deleting Personal — RLS also blocks it. We surface a clear
  // error if it slips through.
  const { data: target } = await supabase
    .from("entities")
    .select("is_personal")
    .eq("id", id)
    .single();
  if (target?.is_personal) {
    throw new Error("The Personal business can't be removed.");
  }

  // Detach any accounts tagged with this entity first (FK ON DELETE SET NULL
  // already handles it, but being explicit is cheap and clear in audit logs).
  await supabase
    .from("accounts")
    .update({ entity_id: null })
    .eq("entity_id", id);

  const { error } = await supabase.from("entities").delete().eq("id", id);
  if (error) throw new Error(`Could not delete: ${error.message}`);

  revalidatePath("/app/settings");
  revalidatePath("/app");
}

/* ── Account → Entity assignment ───────────────────────────────── */

const TagAccountInput = z.object({
  accountId: z.string().uuid(),
  entityId: z.string().uuid().nullable(),
});

export async function tagAccountWithEntity(input: {
  accountId: string;
  entityId: string | null;
}) {
  const parsed = TagAccountInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  // Verify the entity belongs to this user when one is set
  if (parsed.entityId) {
    const { data: e } = await supabase
      .from("entities")
      .select("user_id")
      .eq("id", parsed.entityId)
      .single();
    if (!e || e.user_id !== user.id) {
      throw new Error("That business isn't yours.");
    }
  }

  const { error } = await supabase
    .from("accounts")
    .update({ entity_id: parsed.entityId })
    .eq("id", parsed.accountId);
  if (error) throw new Error(`Tag failed: ${error.message}`);

  revalidatePath("/app");
  revalidatePath("/app/settings");
  revalidatePath(`/app/accounts/${parsed.accountId}`);
}
