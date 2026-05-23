import Decimal from "decimal.js";
import { toDecimal, type Currency, type MoneyInput } from "@/lib/money";

export interface FxRate {
  baseCurrency: Currency;
  targetCurrency: Currency;
  rate: Decimal;
  capturedAt: Date;
}

export type RateResolver = (
  base: Currency,
  target: Currency
) => Promise<Decimal | null>;

export async function convert(
  amount: MoneyInput,
  from: Currency,
  to: Currency,
  resolveRate: RateResolver
): Promise<Decimal> {
  if (from === to) return toDecimal(amount);

  const direct = await resolveRate(from, to);
  if (direct) return toDecimal(amount).times(direct);

  const inverse = await resolveRate(to, from);
  if (inverse && !inverse.isZero()) {
    return toDecimal(amount).dividedBy(inverse);
  }

  throw new FxRateUnavailableError(from, to);
}

export class FxRateUnavailableError extends Error {
  constructor(
    public readonly from: Currency,
    public readonly to: Currency
  ) {
    super(`No FX rate available for ${from}→${to}`);
    this.name = "FxRateUnavailableError";
  }
}
