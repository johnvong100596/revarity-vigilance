import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Entitlement resolution (#2 billing). One place that answers "is this user an
 * operator, and why?" so the rule isn't scattered.
 *
 * Resolution order:
 *   1. A live paid subscription (status in ACTIVE_STATUSES) → operator/paid.
 *   2. profiles.is_operator = true with no live sub → operator/comp (a manual
 *      grant; Cena comping an account, or a legacy operator from before
 *      billing existed).
 *   3. Otherwise → free.
 *
 * The Stripe webhook keeps profiles.is_operator in lockstep with paid status,
 * so the existing gates that read profile.is_operator already enforce billing.
 * This resolver is for surfaces that want to DISTINGUISH paid vs comp (e.g. the
 * Settings billing card shows "Manage billing" only for paid subs).
 */

export type Tier = "free" | "operator";
export type EntitlementSource = "subscription" | "comp" | "none";

export interface Entitlement {
  tier: Tier;
  source: EntitlementSource;
  /** Stripe subscription status when source === "subscription", else null. */
  status: string | null;
  /** ISO timestamp of the current period end, when on a paid sub. */
  currentPeriodEnd: string | null;
  /** True when a paid sub is set to lapse at period end. */
  cancelAtPeriodEnd: boolean;
}

// Statuses that still grant access. past_due is kept entitled through Stripe's
// dunning/grace window — losing access the instant a card fails is hostile and
// Stripe retries before moving to canceled/unpaid.
const ACTIVE_STATUS_LIST = ["trialing", "active", "past_due"] as const;

const FREE: Entitlement = {
  tier: "free",
  source: "none",
  status: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

export async function getEntitlement(
  supabase: SupabaseClient,
  userId: string
): Promise<Entitlement> {
  // 1. ANY active operator subscription for this user (not just the newest
  //    row — a user with a newer canceled sub + an older active one is still
  //    entitled). RLS scopes to own rows.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .eq("plan", "operator")
    .in("status", ACTIVE_STATUS_LIST as unknown as string[])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sub) {
    return {
      tier: "operator",
      source: "subscription",
      status: sub.status as string,
      currentPeriodEnd: (sub.current_period_end as string | null) ?? null,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    };
  }

  // 2. Manual grant / legacy operator.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_operator")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.is_operator) {
    return { ...FREE, tier: "operator", source: "comp" };
  }

  // 3. Free.
  return FREE;
}
