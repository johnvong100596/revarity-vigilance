import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Lost · Vigilance",
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-6 py-12 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-primary">
        404
      </div>
      <h1 className="mt-4 max-w-[440px] text-balance text-[40px] font-bold leading-[1.05] tracking-[-0.025em] text-text-primary md:text-[56px]">
        That page wandered off.
      </h1>
      <p className="mx-auto mt-5 max-w-[360px] text-base leading-relaxed text-text-secondary">
        Either the link&apos;s outdated, or we moved something. Either way,
        let&apos;s get you back.
      </p>
      <Link
        href="/"
        className="group mt-8 inline-flex items-center gap-2 rounded-full bg-accent-primary px-7 py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
      >
        Head home
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </Link>
    </main>
  );
}
