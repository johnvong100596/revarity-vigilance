import Link from "next/link";

import {
  daysSinceTouched,
  getAccountDecayState,
} from "@/lib/decay";
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
}

export function AccountRow({ account, position }: AccountRowProps) {
  const isDebt = account.category === "debt";
  const balanceDecimal = toDecimal(account.balance);
  const display = formatBalance(balanceDecimal, account.currency);
  const decay = getAccountDecayState(account);
  const days = daysSinceTouched(account);

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
          EDGE_COLOR[account.account_type]
        )}
        aria-hidden
      />
      <div className="pl-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            {account.name}
          </span>
          {decay === "warning" && (
            <span
              aria-hidden
              title={`Unchecked ${days} days`}
              className="inline-block h-1.5 w-1.5 rounded-full bg-decay-warning"
            />
          )}
        </div>
        {account.subtitle && (
          <div className="text-xs text-text-secondary">{account.subtitle}</div>
        )}
      </div>
      <div className="text-right">
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
