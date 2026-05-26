"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-6 py-12 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-negative">
        Something went sideways
      </div>
      <h1 className="mt-4 max-w-[440px] text-balance text-[36px] font-bold leading-[1.1] tracking-[-0.025em] text-text-primary md:text-[48px]">
        That didn&apos;t work.
      </h1>
      <p className="mx-auto mt-5 max-w-[360px] text-base leading-relaxed text-text-secondary">
        Something tripped on our end. Try again — most of the time, this
        clears on a reload.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
        <button
          type="button"
          onClick={() => reset()}
          className="group inline-flex items-center gap-2 rounded-full bg-accent-primary px-7 py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <RefreshCw className="h-4 w-4 transition group-hover:rotate-180" />
          Try again
        </button>
        <Link
          href="/"
          className="text-sm font-medium text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
        >
          Head home →
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
