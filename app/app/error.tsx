"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[/app error]", error);
  }, [error]);

  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-negative">
        Something went sideways
      </div>
      <h1 className="mt-4 max-w-[400px] text-balance text-3xl font-bold leading-tight tracking-[-0.025em] text-text-primary md:text-4xl">
        That didn&apos;t work.
      </h1>
      <p className="mx-auto mt-5 max-w-[320px] text-sm leading-relaxed text-text-secondary">
        Probably a hiccup. Try again — most of the time, this clears on a
        reload.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
        <button
          type="button"
          onClick={() => reset()}
          className="group inline-flex items-center gap-2 rounded-full bg-accent-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <RefreshCw className="h-4 w-4 transition group-hover:rotate-180" />
          Try again
        </button>
        <Link
          href="/app"
          className="text-sm font-medium text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
        >
          Back to home →
        </Link>
      </div>

      {error.digest && (
        <p className="mt-10 text-[11px] text-text-muted">
          Error ID: <span className="tabular-nums">{error.digest}</span>
        </p>
      )}
    </main>
  );
}
