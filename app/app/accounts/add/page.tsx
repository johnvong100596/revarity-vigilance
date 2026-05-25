import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { runHintsEngine } from "@/lib/hints/engine";
import { createClient } from "@/lib/supabase/server";
import { CURRENCIES } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ACCOUNT_TYPES = [
  { value: "bank", label: "Bank account", category: "asset" },
  { value: "cash", label: "Cash", category: "asset" },
  { value: "investment", label: "Investment", category: "asset" },
  { value: "crypto", label: "Crypto", category: "asset" },
  { value: "loan", label: "Loan or credit card", category: "debt" },
] as const;

const AccountInput = z.object({
  name: z.string().min(1, "Name is required").max(64),
  subtitle: z.string().max(64).nullable(),
  account_type: z.enum(["bank", "crypto", "investment", "loan", "cash"]),
  currency: z.enum(["USD", "CAD", "EUR", "PYG"]),
  balance: z.number().finite(),
});

async function addAccountAction(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const raw = {
    name: String(formData.get("name") ?? "").trim(),
    subtitle: String(formData.get("subtitle") ?? "").trim() || null,
    account_type: formData.get("account_type"),
    currency: formData.get("currency"),
    balance: Number(formData.get("balance") ?? 0),
  };

  const parsed = AccountInput.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      "Invalid input: " +
        JSON.stringify(parsed.error.flatten().fieldErrors)
    );
  }

  const data = parsed.data;
  const accountType = ACCOUNT_TYPES.find((t) => t.value === data.account_type);
  const category = accountType?.category ?? "asset";

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: data.name,
    subtitle: data.subtitle,
    account_type: data.account_type,
    category,
    currency: data.currency,
    balance: data.balance,
    source: "manual",
    last_balance_updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(`Could not create account: ${error.message}`);

  await runHintsEngine(user.id);
  redirect("/app");
}

export default async function AddAccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("home_currency")
    .eq("id", user.id)
    .single();

  const defaultCurrency = profile?.home_currency ?? "USD";

  return (
    <>
      <header className="mb-8 flex items-center justify-between">
        <Link
          href="/app"
          aria-label="Back"
          className="-m-2 p-2 text-text-secondary transition hover:text-text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          New account
        </div>
        <div className="w-9" />
      </header>

      <h1 className="mb-8 text-3xl font-bold tracking-[-0.025em] text-text-primary">
        Add account
      </h1>

      <form action={addAccountAction} className="space-y-5">
        <div className="space-y-2">
          <Label
            htmlFor="account_type"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary"
          >
            Type
          </Label>
          <select
            name="account_type"
            id="account_type"
            defaultValue="bank"
            required
            className="flex h-11 w-full rounded-md border border-text-primary/12 bg-bg-tertiary px-3.5 py-2 text-sm text-text-primary focus-visible:border-accent-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/15"
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="name"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary"
          >
            Name
          </Label>
          <Input
            id="name"
            name="name"
            required
            maxLength={64}
            placeholder="Mercury, Scotiabank, Visa…"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="subtitle"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary"
          >
            Subtitle
          </Label>
          <Input
            id="subtitle"
            name="subtitle"
            maxLength={64}
            placeholder="Business · Checking · Joint…"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-2">
            <Label
              htmlFor="balance"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary"
            >
              Balance
            </Label>
            <Input
              id="balance"
              name="balance"
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              className="tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="currency"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary"
            >
              Currency
            </Label>
            <select
              name="currency"
              id="currency"
              defaultValue={defaultCurrency}
              required
              className="flex h-11 w-full rounded-md border border-text-primary/12 bg-bg-tertiary px-3.5 py-2 text-sm text-text-primary focus-visible:border-accent-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/15"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-text-muted">
          For debt accounts (loans, credit cards), enter the balance owed as a
          positive number. Net worth math handles the sign. Detailed fields
          like APR, statement close day, and credit limit are added in account
          settings.
        </p>

        <Button type="submit" size="lg" className="w-full">
          Add account
        </Button>
      </form>
    </>
  );
}
