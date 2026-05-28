import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { BankIcon } from "@/components/BankIcon";
import { UtilizationBar } from "@/components/UtilizationBar";
import {
  getCachedLogosMap,
  type InstitutionLogo,
} from "@/lib/institution-logos";
import { formatBalance, type Currency } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { Account, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CreditPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("home_currency, active_workspace_id")
    .eq("id", user.id)
    .single();
  const profile = profileRow as Pick<
    Profile,
    "home_currency" | "active_workspace_id"
  > | null;
  if (!profile?.active_workspace_id) redirect("/login");

  const { data: accountsData } = await supabase
    .from("accounts")
    .select("*")
    .eq("workspace_id", profile.active_workspace_id)
    .eq("archived", false);
  const accounts = (accountsData ?? []) as Account[];

  // Credit cards = debt accounts with a known credit_limit > 0
  const cards = accounts.filter(
    (a) =>
      a.category === "debt" &&
      a.credit_limit != null &&
      Number(a.credit_limit) > 0
  );

  // Per-card logo lookup (read cache only)
  const institutionIds = cards
    .map((c) => c.institution_id)
    .filter((id): id is string => Boolean(id));
  const logoMap: Record<string, InstitutionLogo> =
    institutionIds.length > 0
      ? await getCachedLogosMap(supabase, institutionIds).catch(
          () => ({}) as Record<string, InstitutionLogo>
        )
      : {};

  const homeCurrency: Currency = profile.home_currency ?? "USD";

  const totalLimit = cards.reduce((s, c) => s + Number(c.credit_limit), 0);
  const totalBalance = cards.reduce((s, c) => s + Number(c.balance), 0);
  const totalAvailable = Math.max(0, totalLimit - totalBalance);
  const totalUsage = totalLimit > 0 ? totalBalance / totalLimit : 0;

  return (
    <>
      <header className="mb-6 flex items-center gap-2">
        <Link
          href="/app"
          aria-label="Back"
          className="-m-2 p-2 text-text-secondary transition hover:text-text-primary"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold text-text-primary">
          Credit use
        </h1>
      </header>

      {cards.length === 0 ? (
        <section className="mt-12 text-center">
          <p className="mx-auto max-w-[300px] text-[15px] leading-relaxed text-text-secondary">
            No credit cards connected yet. Connect a bank that has one and
            your credit use shows up here.
          </p>
          <Link
            href="/app/accounts/add"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Connect a bank
          </Link>
        </section>
      ) : (
        <>
          {/* Total */}
          <section className="mb-8 rounded-card border border-text-primary/8 bg-bg-tertiary p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Using {Math.round(totalUsage * 100)}% of your credit
            </div>
            <div className="mt-3">
              <UtilizationBar fraction={totalUsage} />
            </div>
            <div className="mt-4 flex items-baseline justify-between text-sm">
              <div>
                <div className="text-text-secondary">Owing now</div>
                <div className="text-base font-semibold tabular-nums text-text-primary">
                  {formatBalance(totalBalance, homeCurrency, {
                    roundWholeAbove1000: true,
                  })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-text-secondary">Still available</div>
                <div className="text-base font-semibold tabular-nums text-text-primary">
                  {formatBalance(totalAvailable, homeCurrency, {
                    roundWholeAbove1000: true,
                  })}
                </div>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-text-muted">
              Max across all cards:{" "}
              <span className="tabular-nums">
                {formatBalance(totalLimit, homeCurrency, {
                  roundWholeAbove1000: true,
                })}
              </span>
            </div>
          </section>

          {/* Per-card */}
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            By card
          </div>
          <ul className="space-y-2.5">
            {cards
              .slice()
              .sort(
                (a, b) =>
                  Number(b.balance) / Number(b.credit_limit) -
                  Number(a.balance) / Number(a.credit_limit)
              )
              .map((c) => {
                const limit = Number(c.credit_limit);
                const balance = Number(c.balance);
                const util = limit > 0 ? balance / limit : 0;
                const available = Math.max(0, limit - balance);
                const logo = c.institution_id
                  ? logoMap[c.institution_id]
                  : null;
                return (
                  <li
                    key={c.id}
                    className="rounded-card border border-text-primary/8 bg-bg-tertiary p-4"
                  >
                    <div className="flex items-start gap-3">
                      <BankIcon
                        logoBase64={logo?.logo_base64}
                        colorPrimary={logo?.color_primary}
                        label={c.name}
                        size={36}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="truncate text-sm font-medium text-text-primary">
                            {c.name}
                          </div>
                          <div className="shrink-0 text-sm font-semibold tabular-nums text-text-primary">
                            {Math.round(util * 100)}%
                          </div>
                        </div>
                        <UtilizationBar fraction={util} className="mt-2" />
                        <div className="mt-2 flex justify-between text-[11px] text-text-muted">
                          <span>
                            {formatBalance(balance, c.currency, {
                              roundWholeAbove1000: true,
                            })}{" "}
                            owing
                          </span>
                          <span>
                            {formatBalance(available, c.currency, {
                              roundWholeAbove1000: true,
                            })}{" "}
                            still available
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-text-muted">
            Lenders watch this number. Anything over 30% can affect your
            credit score.
          </p>
        </>
      )}
    </>
  );
}
