"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addAccount } from "@/lib/actions/accounts";
import { CURRENCIES, type Currency } from "@/lib/money";

type AccountType = "bank" | "cash" | "investment" | "crypto" | "loan";

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "bank", label: "Bank account" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
  { value: "crypto", label: "Crypto" },
  { value: "loan", label: "Loan or credit card" },
];

interface AddAccountFormProps {
  defaultCurrency: Currency;
}

export function AddAccountForm({ defaultCurrency }: AddAccountFormProps) {
  const [type, setType] = useState<AccountType>("bank");
  const isLoan = type === "loan";

  return (
    <form action={addAccount} className="space-y-5">
      {/* Type */}
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
          value={type}
          onChange={(e) => setType(e.target.value as AccountType)}
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

      {/* Name */}
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
          placeholder={isLoan ? "Visa, Mortgage, Car loan…" : "Mercury, Scotiabank…"}
        />
      </div>

      {/* Subtitle */}
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
          placeholder={isLoan ? "TD Visa Infinite · Mortgage" : "Business · Checking · Joint…"}
        />
      </div>

      {/* Balance + Currency */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <Label
            htmlFor="balance"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary"
          >
            {isLoan ? "Balance owed" : "Balance"}
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

      {/* Debt-only details — APR, limit, dates, etc. */}
      {isLoan && (
        <div className="space-y-5 rounded-card border border-text-primary/10 bg-bg-tertiary p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-primary">
            Debt details · helps the hint engine
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="apr"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary"
            >
              APR (annual %)
            </Label>
            <Input
              id="apr"
              name="apr"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="6.49"
              className="tabular-nums"
            />
            <p className="text-[11px] leading-relaxed text-text-muted">
              Unlocks H-001 (Debt prioritization). APR over ~4% beats market
              after-tax return, so paying it off wins.
            </p>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="credit_limit"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary"
            >
              Credit limit
            </Label>
            <Input
              id="credit_limit"
              name="credit_limit"
              type="number"
              step="0.01"
              min="0"
              placeholder="Credit cards only"
              className="tabular-nums"
            />
            <p className="text-[11px] leading-relaxed text-text-muted">
              Leave blank for mortgages, car loans, fixed installment debt.
              Combined with statement close day, unlocks H-002 (Credit
              utilization danger).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label
                htmlFor="statement_close_day"
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary"
              >
                Statement close day
              </Label>
              <Input
                id="statement_close_day"
                name="statement_close_day"
                type="number"
                min="1"
                max="31"
                placeholder="1–31"
                className="tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="payment_due_day"
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary"
              >
                Payment due day
              </Label>
              <Input
                id="payment_due_day"
                name="payment_due_day"
                type="number"
                min="1"
                max="31"
                placeholder="1–31"
                className="tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="min_payment"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary"
            >
              Minimum payment
            </Label>
            <Input
              id="min_payment"
              name="min_payment"
              type="number"
              step="0.01"
              min="0"
              placeholder="Monthly minimum"
              className="tabular-nums"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="renewal_date"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary"
            >
              Renewal date
            </Label>
            <Input
              id="renewal_date"
              name="renewal_date"
              type="date"
              className="tabular-nums"
            />
            <p className="text-[11px] leading-relaxed text-text-muted">
              Mortgages — when does the rate reset? Unlocks H-101 (Mortgage
              renewal window) when renewal is within 18 months.
            </p>
          </div>
        </div>
      )}

      {!isLoan && (
        <p className="text-xs leading-relaxed text-text-muted">
          For debt accounts (loans, credit cards), switch the Type above to
          unlock APR, credit limit, and statement date fields so the hint
          engine has something to evaluate.
        </p>
      )}

      <Button type="submit" size="lg" className="w-full">
        Add account
      </Button>
    </form>
  );
}
