import { createClient } from "@/lib/supabase/server";
import type { Account, Profile } from "@/lib/types";
import { HINT_REGISTRY } from "./registry";
import { SEVERITY_SCORE, type UserContext } from "./types";

interface RunOptions {
  /** If provided, scope account fetch + insert to this workspace. If
   * omitted, falls back to the user's active workspace from profile. */
  workspaceId?: string;
}

/**
 * Evaluate every registered hint against the user's current state and insert
 * any new firings. Idempotent: if an active hint with the same template_id +
 * related_account_id already exists for the user, the firing is skipped (per
 * THESIS.md §6 dedup rule).
 *
 * Currently called from server actions after any balance-changing write
 * (lib/actions/checkin.ts:editAccountBalance,
 *  lib/actions/accounts.ts:updateAccountBalance,
 *  app/app/accounts/add addAccountAction). A nightly cron will take over
 * the bulk evaluation in Day 6 once the Edge Function infrastructure lands.
 *
 * Failures are caught and logged — hints firing must NEVER block the
 * write that triggered evaluation.
 */
export async function runHintsEngine(
  userId: string,
  options: RunOptions = {}
): Promise<void> {
  try {
    const supabase = createClient();

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    const profile = profileRow as Profile | null;
    if (!profile) return;
    if (profile.expert_hints_enabled === false) return;

    const workspaceId = options.workspaceId ?? profile.active_workspace_id;
    if (!workspaceId) return;

    const [accountsRes, activeHintsRes] = await Promise.all([
      supabase
        .from("accounts")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("archived", false),
      supabase
        .from("hints")
        .select("hint_template_id, related_account_id")
        .eq("workspace_id", workspaceId)
        .eq("status", "active"),
    ]);

    const accounts = (accountsRes.data ?? []) as Account[];

    const dedupKeys = new Set(
      (activeHintsRes.data ?? []).map((h) =>
        dedupKey(h.hint_template_id as string, h.related_account_id as string | null)
      )
    );

    const ctx: UserContext = { userId, profile, accounts };

    const results = await Promise.all(
      HINT_REGISTRY.map(async (evaluator) => {
        try {
          const res = await evaluator.eval(ctx);
          return { evaluator, res };
        } catch (err) {
          console.error(`[hints] ${evaluator.id} eval threw`, err);
          return null;
        }
      })
    );

    const rows = [];
    for (const r of results) {
      if (!r || !r.res.fires) continue;
      const key = dedupKey(r.evaluator.templateId, r.res.relatedAccountId ?? null);
      if (dedupKeys.has(key)) continue;
      rows.push({
        user_id: userId,
        workspace_id: workspaceId,
        hint_template_id: r.evaluator.templateId,
        category: r.evaluator.severity,
        severity_score: SEVERITY_SCORE[r.evaluator.severity],
        title: r.evaluator.title,
        body: r.res.body ?? r.evaluator.title,
        data_snapshot: r.res.data ?? {},
        related_account_id: r.res.relatedAccountId ?? null,
        action_label: r.res.actionLabel ?? null,
        action_target: r.res.actionTarget ?? null,
        status: "active" as const,
      });
    }

    if (rows.length === 0) return;

    const { error } = await supabase.from("hints").insert(rows);
    if (error) {
      console.error("[hints] insert failed", error);
    }
  } catch (err) {
    console.error("[hints] engine failed", err);
  }
}

function dedupKey(templateId: string, relatedAccountId: string | null): string {
  return `${templateId}::${relatedAccountId ?? ""}`;
}
