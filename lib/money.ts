import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_EVEN });

export type Currency = "USD" | "CAD" | "EUR" | "PYG";

export const CURRENCIES: readonly Currency[] = ["USD", "CAD", "EUR", "PYG"];

const MINOR_UNITS: Record<Currency, number> = {
  USD: 2,
  CAD: 2,
  EUR: 2,
  PYG: 0,
};

const SYMBOLS: Record<Currency, string> = {
  USD: "$",
  CAD: "C$",
  EUR: "€",
  PYG: "₲",
};

export type MoneyInput = Decimal | string | number;

export function toDecimal(value: MoneyInput): Decimal {
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

export function add(a: MoneyInput, b: MoneyInput): Decimal {
  return toDecimal(a).plus(toDecimal(b));
}

export function subtract(a: MoneyInput, b: MoneyInput): Decimal {
  return toDecimal(a).minus(toDecimal(b));
}

export function multiply(a: MoneyInput, b: MoneyInput): Decimal {
  return toDecimal(a).times(toDecimal(b));
}

export function divide(a: MoneyInput, b: MoneyInput): Decimal {
  return toDecimal(a).dividedBy(toDecimal(b));
}

export function isZero(value: MoneyInput): boolean {
  return toDecimal(value).isZero();
}

export function isNegative(value: MoneyInput): boolean {
  return toDecimal(value).isNegative();
}

export function symbolFor(currency: Currency): string {
  return SYMBOLS[currency];
}

export function minorUnitsFor(currency: Currency): number {
  return MINOR_UNITS[currency];
}

export interface FormatBalanceOptions {
  withSymbol?: boolean;
  showSign?: boolean;
  showZeroDecimals?: boolean;
  /**
   * Big-number mode (Task 6.4): drop the cents when the amount is ≥ 1000,
   * so a prominent figure reads "$1,247,833" not "$1,247,832.50". Opt-in —
   * detail/check-in screens still show exact cents. No effect on
   * zero-minor-unit currencies like PYG.
   */
  roundWholeAbove1000?: boolean;
}

export function formatBalance(
  amount: MoneyInput,
  currency: Currency,
  options: FormatBalanceOptions = {}
): string {
  const {
    withSymbol = true,
    showSign = false,
    showZeroDecimals = true,
    roundWholeAbove1000 = false,
  } = options;
  let decimals = MINOR_UNITS[currency];
  const value = toDecimal(amount);
  if (roundWholeAbove1000 && value.abs().greaterThanOrEqualTo(1000)) {
    decimals = 0;
  }
  const fractionDigits = showZeroDecimals ? decimals : value.decimalPlaces();

  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Math.min(fractionDigits, decimals),
    maximumFractionDigits: decimals,
  });

  const abs = value.abs();
  const formatted = formatter.format(abs.toNumber());

  let sign = "";
  if (value.isNegative()) sign = "−";
  else if (showSign && value.isPositive()) sign = "+";

  return `${sign}${withSymbol ? SYMBOLS[currency] : ""}${formatted}`;
}
