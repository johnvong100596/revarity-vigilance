"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

interface HeroOrbProps {
  /** CSS positioning class — pin the orb wherever you want it to sit. */
  className?: string;
  /** Diameter in px (orb is rendered as a square). */
  size?: number;
  /** 0-1 alpha of the inner red. Lower for subtler effect. */
  intensity?: number;
  /** How far it drifts down as the user scrolls past 1500px. */
  driftY?: number;
  /** How far it drifts horizontally as the user scrolls past 1500px. */
  driftX?: number;
}

/**
 * Soft red radial-gradient orb. Decorative — sits behind content with
 * pointer-events:none. Drifts slowly with scroll position to create a
 * sense of depth without distracting from text. The fixed positioning
 * means it tracks the viewport, so the orb's "drift" becomes parallax
 * relative to the page content beneath it.
 *
 * Honors prefers-reduced-motion (renders static).
 */
export function HeroOrb({
  className = "left-1/2 top-[18vh] -translate-x-1/2",
  size = 720,
  intensity = 0.16,
  driftY = 200,
  driftX = -60,
}: HeroOrbProps) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 1500], [0, driftY]);
  const x = useTransform(scrollY, [0, 1500], [0, driftX]);

  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none fixed -z-10 rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, rgba(240,78,55,${intensity}) 0%, transparent 60%)`,
        filter: "blur(80px)",
        willChange: "transform",
        y: reduce ? 0 : y,
        x: reduce ? 0 : x,
      }}
    />
  );
}
