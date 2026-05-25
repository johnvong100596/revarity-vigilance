import { H001 } from "./H-001-debt-priority";
import { H002 } from "./H-002-credit-utilization";
import { H101 } from "./H-101-mortgage-renewal";
import { H103 } from "./H-103-hisa-arbitrage";
import { H201 } from "./H-201-portfolio-weighting";
import { H202 } from "./H-202-tax-residency";
import type { HintEvaluator } from "./types";

// Edit this list to add or remove hints from the engine.
// Order matters only for tie-breaking when multiple hints fire simultaneously
// — engine itself runs them in parallel.
export const HINT_REGISTRY: HintEvaluator[] = [
  H001,
  H002,
  H101,
  H103,
  H201,
  H202,
];
