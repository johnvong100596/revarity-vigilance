"use client";

import { Smartphone, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { INSTALL_OPEN_EVENT } from "@/components/marketing/InstallExperience";

/**
 * Opens the install modal. Lives in a few spots on the landing page (hero,
 * footer), so it just dispatches a window event that the single mounted
 * InstallExperience listens for — no prop-drilling through the server page.
 */
export function InstallButton({
  variant = "hero",
  className,
}: {
  variant?: "hero" | "footer";
  className?: string;
}) {
  const open = () => window.dispatchEvent(new CustomEvent(INSTALL_OPEN_EVENT));

  if (variant === "footer") {
    return (
      <button
        type="button"
        onClick={open}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-text-primary/15 bg-bg-tertiary px-5 py-2.5 text-sm font-semibold text-text-primary transition hover:border-accent-primary/40 hover:text-accent-primary",
          className,
        )}
      >
        <Smartphone className="h-4 w-4" />
        Install Vigilance
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "group inline-flex items-center gap-2 text-sm font-medium text-text-secondary underline-offset-4 transition hover:text-accent-primary hover:underline",
        className,
      )}
    >
      <Smartphone className="h-4 w-4" />
      Install on your phone
      <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
    </button>
  );
}
