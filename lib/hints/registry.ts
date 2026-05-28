import { H001 } from "./H-001-debt-priority";
import { H002 } from "./H-002-credit-utilization";
import { H101 } from "./H-101-mortgage-renewal";
import { H103 } from "./H-103-hisa-arbitrage";
import { H201 } from "./H-201-portfolio-weighting";
import { H202 } from "./H-202-tax-residency";
import { H301 } from "./H-301-card-high-utilization";
import { H302 } from "./H-302-total-utilization";
import { H303 } from "./H-303-payment-overdue";
import { H305 } from "./H-305-iou-due-soon";
import { H306 } from "./H-306-iou-recurring-soon";
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
  H301,
  H302,
  H303,
  H305,
  H306,
];
