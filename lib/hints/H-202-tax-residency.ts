import type { HintEvaluator } from "./types";

/**
 * H-202 Tax residency day-count.
 *
 * Spec from THESIS.md §6:
 *   Trigger: international user AND day-count in any country > 50% of legal
 *   threshold YTD.
 *
 * v1 status: SCAFFOLDED, NOT ACTIVE.
 *
 * The day-count tracking infrastructure (a `presence_days` table the user
 * logs against, plus per-jurisdiction thresholds) isn't built yet. Without
 * it the evaluator has no signal to fire on. This module is in the registry
 * so the engine has its placeholder ready, but `eval` returns fires:false.
 *
 * TODO Day 3-4: ship presence_days table + a quick log UI, then wire this
 * evaluator to compute YTD totals per profile.jurisdictions and fire when
 * any one is >50% of its threshold.
 */
export const H202: HintEvaluator = {
  id: "H-202",
  templateId: "H-202-tax-residency",
  severity: "strategic",
  title: "Tax residency day-count",
  eval() {
    return { fires: false };
  },
};
