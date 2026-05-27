import Link from "next/link";

import { BankIcon } from "@/components/BankIcon";
import {
  daysSinceTouched,
  getAccountDecayState,
} from "@/lib/decay";
import type { InstitutionLogo } from "@/lib/institution-logos";
import { formatBalance, toDecimal } from "@/lib/money";
import type { Account } from "@/lib/types";
import { cn } from "@/lib/utils";

const EDGE_COLOR: Record<Account["account_type"], string> = {
  bank: "bg-accent-primary",
  cash: "bg-accent-primary",
  investment: "bg-invest-accent",
  crypto: "bg-crypto-accent",
  loan: "bg-negative",
};

interface AccountRowProps {
  account: Account;
  position: "first" | "middle" | "last" | "only";
  logo?: InstitutionLogo | null;
}

export function AccountRow({ account, position, logo }: AccountRowProps) {
  const isDebt = account.category === "debt";
  // Use the magnitude — we render the sign ourselves below, so a balance
  // stored negative (e.g. a manual "-500") won't produce "−−$500".
  const balanceDecimal = toDecimal(account.balance).abs();
  const display = formatBalance(balanceDecimal, account.currency);
  const decay = getAccountDecayState(account);
  const days = daysSinceTouched(account);

  // Task 1.5: when the institution has a bold brand color, tint the
  // left accent stripe with it instead of the generic account-type color.
  const brandColor = logo?.color_primary ?? null;

  return (
    <Link
      href={`/app/accounts/${account.id}`}
      className={cn(
        "relative flex items-center justify-between bg-bg-tertiary px-4 py-3.5 transition hover:bg-bg-secondary",
        position === "first" && "rounded-t-card",
        position === "last" && "rounded-b-card",
        position === "only" && "rounded-card",
        position !== "first" &&
          position !== "only" &&
          "border-t border-text-primary/6",
        decay === "stale" && "opacity-70 grayscale"
      )}
      title={
        decay === "warning"
          ? `Last checked ${days} day${days === 1 ? "" : "s"} ago`
          : decay === "stale"
            ? `Stale — ${days} days since check-in`
            : undefined
      }
    >
      <span
        className={cn(
          "absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full",
          !brandColor && EDGE_COLOR[account.account_type]
        )}
        style={brandColor ? { backgroundColor: brandColor } : undefined}
        aria-hidden
      />
      <div className="flex min-w-0 items-center gap-3 pl-3">
        <BankIcon
          logoBase64={logo?.logo_base64}
          colorPrimary={brandColor}
          label={account.name}
          size={32}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-text-primary">
              {account.name}
            </span>
            {decay === "warning" && (
              <span
                aria-hidden
                title={`Unchecked ${days} days`}
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-decay-warning"
              />
            )}
          </div>
          {account.subtitle && (
            <div className="truncate text-xs text-text-secondary">
              {account.subtitle}
            </div>
          )}
        </div>
      </div>
      <div className="pl-2 text-right">
        <div
          className={cn(
            "text-[15px] font-semibold tabular-nums tracking-[-0.01em]",
            isDebt ? "text-negative" : "text-text-primary"
          )}
        >
          {isDebt ? "−" : ""}
          {display}
        </div>
      </div>
    </Link>
  );
}
