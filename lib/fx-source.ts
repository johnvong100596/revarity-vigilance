import { CURRENCIES, type Currency } from "@/lib/money";

/**
 * Fetch current USD-base FX rates.
 *
 * Source: open.er-api.com — free, no API key, daily mid-market rates (the same
 * mid-market rates Google shows). NOTE: Google has no public currency-conversion
 * API anymore, so we use this provider, which covers all of our currencies
 * including PYG. Swap the URL here if you want a different provider.
 *
 * Returns USD→target (units of target per 1 USD) for each supported currency.
 */
const SOURCE_URL = "https://open.er-api.com/v6/latest/USD";

export interface UsdRates {
  /** target currency → units of target per 1 USD */
  rates: Partial<Record<Currency, number>>;
  fetchedAt: string;
}

export async function fetchUsdRates(): Promise<UsdRates> {
  const res = await fetch(SOURCE_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`FX source returned ${res.status}`);
  }
  const json = (await res.json()) as {
    result?: string;
    rates?: Record<string, number>;
  };
  if (json.result !== "success" || !json.rates) {
    throw new Error("FX source returned an unexpected payload");
  }

  const rates: Partial<Record<Currency, number>> = {};
  for (const c of CURRENCIES) {
    const r = json.rates[c];
    if (typeof r === "number" && r > 0) rates[c] = r;
  }
  return { rates, fetchedAt: new Date().toISOString() };
}
