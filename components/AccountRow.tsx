import Link from "next/link";

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

  return (
    <Link
      href={`/accounts/${account.id}`}
      className={cn(
        "relative flex items-center justify-between bg-bg-secondary px-3.5 py-3 transition hover:bg-bg-tertiary",
        position === "first" && "rounded-t-card",
        position === "last" && "rounded-b-card",
        position === "only" && "rounded-card",
        position !== "first" && position !== "only" && "border-t border-white/[0.04]"
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r",
          EDGE_COLOR[account.account_type]
        )}
        aria-hidden
      />
      <div className="pl-2.5">
        <div className="text-xs text-text-primary">{account.name}</div>
        {account.subtitle && (
          <div className="text-[10px] text-text-secondary">{account.subtitle}</div>
        )}
      </div>
      <div className="text-right">
        <div
          className={cn(
            "text-[13px] font-medium tabular-nums",
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
