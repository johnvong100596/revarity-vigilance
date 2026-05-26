"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

interface AnimatedSectionProps {
  children: ReactNode;
  className?: string;
  /** Distance the section starts below its final position (px). */
  delta?: number;
  /** Animation duration in seconds. */
  duration?: number;
  /** IntersectionObserver root margin — earlier = bigger negative value. */
  margin?: string;
  style?: CSSProperties;
}

/**
 * Wraps a section element with a fade + rise-into-place animation that
 * fires once when the section scrolls into view. Honors prefers-reduced-motion:
 * if the user has opted out, the section just renders at its final position
 * with no transition.
 */
export function AnimatedSection({
  children,
  className,
  delta = 24,
  duration = 0.55,
  margin = "-80px",
  style,
}: AnimatedSectionProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <section className={className} style={style}>
        {children}
      </section>
    );
  }

  return (
    <motion.section
      className={className}
      style={style}
      initial={{ opacity: 0, y: delta }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin }}
      transition={{ duration, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.section>
  );
}
