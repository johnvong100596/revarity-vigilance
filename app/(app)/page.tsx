export default function HomePage() {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center gap-3 text-center">
      <div className="text-xs tracking-[0.2em] text-text-secondary">
        VIGILANCE
      </div>
      <h1 className="font-ledger text-4xl text-text-primary">
        $0.00
      </h1>
      <p className="text-xs text-text-muted">
        Day 1 placeholder · home renders here after auth
      </p>
    </main>
  );
}
