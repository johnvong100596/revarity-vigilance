import type { Account, Iou, Profile } from "@/lib/types";

export type HintSeverity = "pay_attention" | "opportunity" | "strategic";

export interface UserContext {
  userId: string;
  profile: Profile;
  accounts: Account[];
  /** Active IOUs for the user (v1.1 WS6). Empty for non-operators. Hints
   *  that only need account data can ignore this. */
  ious?: Iou[];
}

export interface HintFireResult {
  fires: boolean;
  body?: string;
  data?: Record<string, unknown>;
  relatedAccountId?: string | null;
  actionLabel?: string | null;
  actionTarget?: string | null;
}

export interface HintEvaluator {
  /** Human-readable code from THESIS.md §6 (e.g. "H-001"). */
  id: string;
  /** Stable string written to hints.hint_template_id — used for dedup. */
  templateId: string;
  severity: HintSeverity;
  title: string;
  eval(ctx: UserContext): HintFireResult | Promise<HintFireResult>;
}

/** Base severity scores per THESIS.md §6 / ARCHITECTURE.md §6. */
export const SEVERITY_SCORE: Record<HintSeverity, number> = {
  pay_attention: 100,
  opportunity: 60,
  strategic: 40,
};
