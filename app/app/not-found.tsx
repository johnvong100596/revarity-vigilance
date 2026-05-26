import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Lost · Vigilance",
};

export default function AppNotFound() {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-primary">
        404
      </div>
      <h1 className="mt-4 max-w-[400px] text-balance text-3xl font-bold leading-tight tracking-[-0.025em] text-text-primary md:text-4xl">
        That page wandered off.
      </h1>
      <p className="mx-auto mt-5 max-w-[320px] text-sm leading-relaxed text-text-secondary">
        Probably moved, probably renamed. Back to your home screen.
      </p>
      <Link
        href="/app"
        className="group mt-8 inline-flex items-center gap-2 rounded-full bg-accent-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
      >
        Back to home
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </Link>
    </main>
  );
}
