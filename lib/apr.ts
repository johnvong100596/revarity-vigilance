import type { Account } from "@/lib/types";

/**
 * APR sanity bounds (M6). Plaid occasionally returns absurd interest
 * values for some institutions (negative, zero, or wildly high). We never
 * silently drop the raw value — we store it — but we mark out-of-range
 * APRs as "unverified" so the UI can flag them instead of stating a
 * number we don't trust.
 *
 * Ceilings differ by debt kind:
 *   - amortizing loans (mortgage / auto / student): 25%
 *   - revolving / credit cards / everything else:   60%
 * Floor is > 0 in all cases (a 0% or negative APR isn't a real rate).
 */

const CREDIT_CEILING = 60;
const MORTGAGE_CEILING = 25;

function looksAmortizing(
  account: Pick<Account, "account_type" | "subtitle" | "name">
): boolean {
  // Structured signal first (M1): Plaid/CSV/manual ingest classifies
  // mortgages, auto, student loans and HELOCs as account_type "loan". These
  // amortize, so they get the lower (25%) ceiling. Credit cards are never
  // "loan", so a high-but-valid card APR keeps the 60% credit ceiling and
  // stays verified instead of being mis-tiered by its name.
  if (account.account_type === "loan") return true;
  // Fallback only for manual/CSV rows whose type wasn't set to "loan" but
  // whose name clearly names an amortizing product.
  const text = `${account.subtitle ?? ""} ${account.name ?? ""}`.toLowerCase();
  return /mortgage|student loan|auto loan|car loan|home loan|heloc/.test(text);
}

/** Upper plausibility bound for this account's APR. */
export function aprCeilingFor(
  account: Pick<Account, "account_type" | "subtitle" | "name">
): number {
  return looksAmortizing(account) ? MORTGAGE_CEILING : CREDIT_CEILING;
}

/**
 * True when the APR is present and within plausible bounds for the
 * account kind. null/0/negative/over-ceiling all return false.
 */
export function isAprVerified(
  apr: number | null | undefined,
  account: Pick<Account, "account_type" | "subtitle" | "name">
): boolean {
  if (apr == null || !Number.isFinite(apr)) return false;
  return apr > 0 && apr <= aprCeilingFor(account);
}
