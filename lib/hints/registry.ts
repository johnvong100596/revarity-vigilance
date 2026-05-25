import { H001 } from "./H-001-debt-priority";
import { H103 } from "./H-103-hisa-arbitrage";
import { H201 } from "./H-201-portfolio-weighting";
import type { HintEvaluator } from "./types";

// Edit this list to add or remove hints from the engine.
// Order matters only for tie-breaking when multiple hints fire simultaneously
// — engine itself runs them in parallel.
export const HINT_REGISTRY: HintEvaluator[] = [H001, H103, H201];
