"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import type { ReactNode } from "react";

interface ParallaxBlockProps {
  children: ReactNode;
  className?: string;
  /**
   * How far the block moves over the lifetime of its scroll progress.
   * Negative = moves up faster than the scroll, positive = lags behind.
   * Default -40 gives a gentle "rises into view a bit faster than scroll".
   */
  amount?: number;
}

/**
 * Wraps a block with a scroll-progress-linked Y-transform. Tied to the
 * block's OWN position in the viewport (offset start: "start end" to
 * end: "end start") so the parallax only animates while the block is
 * passing through the viewport, not over the whole document.
 *
 * Honors prefers-reduced-motion (renders static).
 */
export function ParallaxBlock({
  children,
  className,
  amount = -40,
}: ParallaxBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [Math.abs(amount), amount]);

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        y: reduce ? 0 : y,
        willChange: "transform",
      }}
    >
      {children}
    </motion.div>
  );
}
