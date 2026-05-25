import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[420px] px-5 pb-12 pt-6">
      {children}
    </div>
  );
}
