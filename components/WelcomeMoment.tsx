"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { markWelcomed } from "@/lib/actions/onboarding";

interface WelcomeMomentProps {
  netWorthFormatted: string;
}

/**
 * One-time "There you are" moment (WS3 Task 3.2) shown the first time a
 * balance lands on the home screen. Premium and brief: a soft sparkle, the
 * user's net worth, a welcome line — auto-fades after ~3s. Marks itself
 * shown server-side on mount so it never fires again.
 */
export function WelcomeMoment({ netWorthFormatted }: WelcomeMomentProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    markWelcomed().catch(() => {});
    const fade = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(fade);
  }, []);

  // A handful of sparkle positions (cream/red, subtle — not Candy Crush)
  const sparkles = [
    { x: "18%", y: "32%", d: 0 },
    { x: "78%", y: "28%", d: 0.15 },
    { x: "30%", y: "62%", d: 0.3 },
    { x: "68%", y: "66%", d: 0.45 },
    { x: "50%", y: "22%", d: 0.2 },
  ];

  return (
    <AnimatePresence onExitComplete={() => router.refresh()}>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg-primary px-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {sparkles.map((s, i) => (
            <motion.span
              key={i}
              className="absolute h-2 w-2 rounded-full bg-accent-primary"
              style={{ left: s.x, top: s.y }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.3, 0], opacity: [0, 1, 0] }}
              transition={{ duration: 1.1, delay: s.d, repeat: 1 }}
            />
          ))}
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-primary">
              There you are
            </div>
            <div className="mt-3 text-[40px] font-bold leading-none tracking-[-0.03em] tabular-nums text-text-primary">
              {netWorthFormatted}
            </div>
            <div className="mt-4 text-sm text-text-secondary">
              Welcome to Vigilance.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
