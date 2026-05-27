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

function looksAmortizing(account: Pick<Account, "subtitle" | "name">): boolean {
  const text = `${account.subtitle ?? ""} ${account.name ?? ""}`.toLowerCase();
  return /mortgage|student|auto|car loan|home loan|heloc/.test(text);
}

/** Upper plausibility bound for this account's APR. */
export function aprCeilingFor(
  account: Pick<Account, "subtitle" | "name">
): number {
  return looksAmortizing(account) ? MORTGAGE_CEILING : CREDIT_CEILING;
}

/**
 * True when the APR is present and within plausible bounds for the
 * account kind. null/0/negative/over-ceiling all return false.
 */
export function isAprVerified(
  apr: number | null | undefined,
  account: Pick<Account, "subtitle" | "name">
): boolean {
  if (apr == null || !Number.isFinite(apr)) return false;
  return apr > 0 && apr <= aprCeilingFor(account);
}
