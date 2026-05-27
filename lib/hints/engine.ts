import { composeHintBody } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import type { Account, Profile } from "@/lib/types";
import { HINT_REGISTRY } from "./registry";
import { SEVERITY_SCORE, type UserContext } from "./types";

/** Per-day-per-user budget for LLM hint composition (Task 2.4 spec). */
const LLM_HINTS_PER_DAY = 3;

/** Templates where only one hint should be active per workspace at a time,
 *  regardless of which account it references (see L2 dedup logic below). */
const SINGLETON_TEMPLATES = new Set<string>(["H-001-debt-priority"]);

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

    // L2: some hints are singletons per workspace — only one should be
    // active regardless of which account it points at (e.g. "your most
    // expensive debt"). When such a hint fires for a DIFFERENT account
    // than the currently active one (user paid one card down, another
    // is now the worst), retire the stale one so they don't pile up.
    for (const r of results) {
      if (!r || !r.res.fires) continue;
      if (!SINGLETON_TEMPLATES.has(r.evaluator.templateId)) continue;
      const newAccountId = r.res.relatedAccountId ?? null;
      if (!newAccountId) continue;
      await supabase
        .from("hints")
        .update({ status: "muted" })
        .eq("workspace_id", workspaceId)
        .eq("hint_template_id", r.evaluator.templateId)
        .eq("status", "active")
        .neq("related_account_id", newAccountId);
    }

    interface HintInsertRow {
      user_id: string;
      workspace_id: string;
      hint_template_id: string;
      category: "pay_attention" | "opportunity" | "strategic";
      severity_score: number;
      title: string;
      body: string;
      composed_body?: string;
      composed_at?: string;
      data_snapshot: unknown;
      related_account_id: string | null;
      action_label: string | null;
      action_target: string | null;
      status: "active";
    }
    const rows: HintInsertRow[] = [];
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
        status: "active",
      });
    }

    if (rows.length === 0) return;

    // Compose what we can afford via Claude. Cost cap: 3 LLM-composed
    // hints per user per rolling 24h, severity-sorted so the most urgent
    // get the upgrade first.
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: composedToday } = await supabase
      .from("hints")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("composed_at", yesterday);

    let budget = Math.max(0, LLM_HINTS_PER_DAY - (composedToday ?? 0));
    if (budget > 0) {
      const orderedIdxs = rows
        .map((_, i) => i)
        .sort((a, b) => rows[b].severity_score - rows[a].severity_score);

      for (const i of orderedIdxs) {
        if (budget <= 0) break;
        const composed = await composeHintBody(rows[i].body, {
          severity: rows[i].category,
        });
        if (composed) {
          rows[i].composed_body = composed;
          rows[i].composed_at = new Date().toISOString();
          budget--;
        }
      }
    }

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
