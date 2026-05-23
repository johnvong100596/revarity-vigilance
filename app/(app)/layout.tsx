export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[420px] px-5 pb-12 pt-6">
      {children}
    </div>
  );
}
